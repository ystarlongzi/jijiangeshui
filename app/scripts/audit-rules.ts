import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload, type Where } from 'payload'

import { adaptCmsPolicyToCityRule } from '../src/lib/city-rule-adapter'
import {
  createAuditCity,
  normalizePolicyEntry,
  normalizePolicyForCms,
  slugifyRuleEntity,
} from '../src/lib/city-rule-import-normalizer'
import { crawlResultSchema } from '../src/lib/city-rule-import-schema'
import {
  auditCityRule,
  getPrimaryRuleSource,
  getRuleFreshnessLabel,
  getRuleFreshnessStatus,
  getRuleQualityStatus,
  hasRuleSourceUrl,
  type RuleFreshnessStatus,
  type RuleQualityCategory,
  type RuleQualityIssue,
} from '../src/lib/city-rule-quality'
import { cityRules, selectEffectiveCityRule, type CityRule } from '../src/lib/tax-rules'

/**
 * 审计城市社保公积金规则。
 *
 * 默认检查写在代码里的 fallback cityRules，不访问数据库。
 * 也可以传入采集 JSON 文件，先转换成前台 CityRule，再使用同一套质量规则检查。
 *
 * 用法：
 * - npm run rules:audit                         审计前台 fallback cityRules
 * - npm run rules:audit -- ./data/hrwork.json   审计采集或导出的 JSON 文件
 * - npm run rules:audit -- --cms --policy-year 2026
 * - npm run rules:audit -- --cms --policy-year 2026 --summary
 * - npm run rules:audit -- --cms --policy-year 2026 --stale
 * - npm run rules:audit -- ./data/hrwork.json --strict
 *
 * 它适合在修改、导入或采集城市基数、比例、来源信息后快速跑一遍，确认：
 * - 生效日期、核对日期、来源是否完整
 * - 社保/公积金基数范围是否合法
 * - 是否包含社保项目和公积金项目
 * - 公积金比例选项是否覆盖常见 3%-12%
 */
type AuditRow = {
  code: string
  city: string
  effective: string
  checkedAt: string
  socialBase: string
  housingBase: string
  housingRates: string
  sources: number
  freshness: RuleFreshnessStatus
  freshnessLabel: string
  status: 'ok' | 'warning' | 'error'
}

type AuditSource = {
  label: string
  entries: Array<[string, CityRule]>
}

const useJson = process.argv.includes('--json')
const summaryOnly = process.argv.includes('--summary')
const staleOnly = process.argv.includes('--stale')
const strict = process.argv.includes('--strict')
const useCms = process.argv.includes('--cms')
const inputPath = process.argv.find((arg, index) => index > 1 && !arg.startsWith('-'))
let currentIssues: RuleQualityIssue[] = []

type CmsCityDoc = {
  id: string | number
  name?: string | null
  slug?: string | null
  provinceName?: string | null
  shortName?: string | null
}

type CmsPolicyDoc = Parameters<typeof adaptCmsPolicyToCityRule>[0] & {
  city?: string | number | { id?: string | number | null } | null
}

function getFlagValue(name: string) {
  const inlineArg = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inlineArg) return inlineArg.slice(name.length + 1)

  const index = process.argv.indexOf(name)
  if (index >= 0) return process.argv[index + 1]

  return undefined
}

function parsePositiveInteger(value: string | undefined, label: string) {
  if (!value) return undefined

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} 必须是正整数，当前值：${value}`)
  }

  return parsed
}

function parseEnvValue(value: string) {
  const trimmed = value.trim()
  const quote = trimmed[0]

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

async function loadLocalEnv() {
  for (const fileName of ['.env', '.env.local']) {
    const envPath = path.resolve(process.cwd(), fileName)

    try {
      const content = await fs.readFile(envPath, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

        const key = trimmed.slice(0, trimmed.indexOf('=')).trim()
        const value = trimmed.slice(trimmed.indexOf('=') + 1)
        if (key && process.env[key] === undefined) {
          process.env[key] = parseEnvValue(value)
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

function getRelationId(value: CmsPolicyDoc['city']) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && (typeof value.id === 'string' || typeof value.id === 'number')) return String(value.id)
  return undefined
}

function hasSlug(city: CmsCityDoc): city is CmsCityDoc & { slug: string } {
  return typeof city.slug === 'string' && city.slug.trim() !== ''
}

async function loadAuditSource(): Promise<AuditSource> {
  if (useCms) return loadCmsAuditSource()

  if (!inputPath) {
    return { label: 'fallback cityRules', entries: Object.entries(cityRules) }
  }

  const absolutePath = path.resolve(process.cwd(), inputPath)
  const source = crawlResultSchema.parse(JSON.parse(await fs.readFile(absolutePath, 'utf8')))
  const cities = new Map((source.cityInfo?.list || []).map((city) => [slugifyRuleEntity(city), city]))
  const entries = (source.socialInsurancePolicy?.list || []).map(normalizePolicyEntry).flatMap((policy, index) => {
    const code = slugifyRuleEntity(policy) || `policy-${index + 1}`
    const city = cities.get(code)
    return [
      [code, adaptCmsPolicyToCityRule(normalizePolicyForCms(policy), createAuditCity(policy, city))] satisfies [
        string,
        CityRule,
      ],
    ]
  })

  return { label: absolutePath, entries }
}

async function loadCmsAuditSource(): Promise<AuditSource> {
  await loadLocalEnv()
  if (!process.env.DATABASE_URI) {
    throw new Error('缺少 DATABASE_URI。请确认 app/.env 已配置并且 PostgreSQL 已启动。')
  }

  const policyYear = parsePositiveInteger(getFlagValue('--policy-year'), '--policy-year')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const cityResult = await payload.find({
    collection: 'cities',
    depth: 0,
    limit: 1000,
    where: { enabled: { equals: true } },
  })
  const cityMap = new Map((cityResult.docs as CmsCityDoc[]).filter(hasSlug).map((city) => [String(city.id), city]))
  const filters: Where[] = [{ policyStatus: { equals: 'active' } }]
  if (policyYear) filters.push({ policyYear: { equals: policyYear } })

  const policyResult = await payload.find({
    collection: 'social-insurance-policies',
    depth: 0,
    limit: 1000,
    sort: '-effectiveFrom',
    where: { and: filters },
  })
  const groupedPolicies = new Map<string, CmsPolicyDoc[]>()

  for (const policy of policyResult.docs as CmsPolicyDoc[]) {
    const cityId = getRelationId(policy.city)
    if (!cityId || !cityMap.has(cityId)) continue
    groupedPolicies.set(cityId, [...(groupedPolicies.get(cityId) || []), policy])
  }

  const entries = Array.from(groupedPolicies.entries()).flatMap(([cityId, policies]) => {
    const city = cityMap.get(cityId)
    if (!city?.slug) return []

    const versions = policies.map((policy) => adaptCmsPolicyToCityRule(policy, city))
    const activeRule = selectEffectiveCityRule(versions, `${policyYear || new Date().getFullYear()}-12-31`) || versions[0]
    if (!activeRule) return []

    return [[city.slug, { ...activeRule, policyVersions: versions }] satisfies [string, CityRule]]
  })

  await payload.destroy()

  return {
    label: `Payload CMS active social-insurance-policies${policyYear ? ` ${policyYear}` : ''}`,
    entries,
  }
}

function formatRange(min: number, max: number) {
  return `${min}-${max}`
}

function createRow(code: string, rule: CityRule, issues: RuleQualityIssue[]): AuditRow {
  const checkedAt = getPrimaryRuleSource(rule)?.checkedAt || ''
  const freshness = getRuleFreshnessStatus(checkedAt)

  return {
    code,
    city: rule.label,
    effective: rule.effective,
    checkedAt,
    socialBase: formatRange(rule.baseRules.social.min, rule.baseRules.social.max),
    housingBase: formatRange(rule.baseRules.housingFund.min, rule.baseRules.housingFund.max),
    housingRates: rule.housingRateOptions.map((rate) => `${rate}%`).join('/'),
    sources: rule.sources.length,
    freshness,
    freshnessLabel: getRuleFreshnessLabel(freshness),
    status: getRuleQualityStatus(issues),
  }
}

function printIssueGroup(category: RuleQualityCategory, label: string) {
  const group = currentIssues.filter((issue) => issue.category === category)
  if (!group.length) return

  console.log(`\n${label}：`)
  for (const issue of group) {
    console.log(`[${issue.severity}] ${issue.city}: ${issue.message}`)
  }
}

async function main() {
  const source = await loadAuditSource()
  currentIssues = source.entries.flatMap(([code, rule]) => auditCityRule(code, rule))
  const rows = source.entries.map(([code, rule]) =>
    createRow(
      code,
      rule,
      currentIssues.filter((issue) => issue.city === code),
    ),
  )
  const displayRows = staleOnly ? rows.filter((row) => row.freshness !== 'fresh') : rows
  const errorCount = currentIssues.filter((issue) => issue.severity === 'error').length
  const warningCount = currentIssues.filter((issue) => issue.severity === 'warning').length
  const statusSummary = rows.reduce(
    (summary, row) => {
      summary[row.status] += 1
      return summary
    },
    { ok: 0, warning: 0, error: 0 } satisfies Record<AuditRow['status'], number>,
  )
  const sourceUrlCount = source.entries.filter(([, rule]) => hasRuleSourceUrl(rule)).length
  const categorySummary = currentIssues.reduce(
    (summary, issue) => {
      summary[issue.category] += 1
      return summary
    },
    { source: 0, baseRule: 0, itemRule: 0, housingRate: 0 } satisfies Record<RuleQualityCategory, number>,
  )

  const summary = {
    source: source.label,
    cities: rows.length,
    displayedCities: displayRows.length,
    usableCities: rows.length - statusSummary.error,
    status: statusSummary,
    errors: errorCount,
    warnings: warningCount,
    sourceUrlCoveragePercent: rows.length > 0 ? Math.round((sourceUrlCount / rows.length) * 100) : 0,
    categories: categorySummary,
  }

  if (useJson) {
    // JSON 输出方便后续接入 CI、报表或后台任务。
    console.log(
      JSON.stringify(
        {
          rows,
          displayRows,
          issues: currentIssues,
          summary,
        },
        null,
        2,
      ),
    )
  } else if (summaryOnly) {
    console.log(`审计来源：${summary.source}`)
    console.log(
      `完成：${summary.cities} 个城市${staleOnly ? `，展示待复核 ${summary.displayedCities} 个` : ''}，可用 ${summary.usableCities} 个。` +
        ` OK ${summary.status.ok}，提醒 ${summary.status.warning}，错误 ${summary.status.error}。` +
        ` 来源 URL 覆盖率 ${summary.sourceUrlCoveragePercent}%。` +
        ` 问题合计：${summary.errors} 个错误，${summary.warnings} 个提醒。` +
        ` 来源 ${summary.categories.source}，基数 ${summary.categories.baseRule}，项目 ${summary.categories.itemRule}，公积金比例 ${summary.categories.housingRate}。`,
    )
    if (staleOnly && displayRows.length) {
      console.log(`待复核城市：${displayRows.map((row) => `${row.city}(${row.checkedAt || row.freshnessLabel})`).join('、')}`)
    }
    for (const issue of currentIssues.slice(0, 20)) {
      console.log(`[${issue.severity}] ${issue.city}: ${issue.message}`)
    }
    if (currentIssues.length > 20) {
      console.log(`还有 ${currentIssues.length - 20} 条问题未展示，可去掉 --summary 查看完整明细。`)
    }
  } else {
    console.log(`审计来源：${source.label}`)
    if (staleOnly) console.log(`仅展示需要复核或缺少核对日期的城市：${displayRows.length} 个`)
    console.table(displayRows)
    if (currentIssues.length) {
      printIssueGroup('source', '来源问题')
      printIssueGroup('baseRule', '基数问题')
      printIssueGroup('itemRule', '缴费项目问题')
      printIssueGroup('housingRate', '公积金比例问题')
    }
    console.log(
      `\n完成：${rows.length} 个城市，${errorCount} 个错误，${warningCount} 个提醒。` +
        ` 来源 ${categorySummary.source}，基数 ${categorySummary.baseRule}，项目 ${categorySummary.itemRule}，公积金比例 ${categorySummary.housingRate}。`,
    )
  }

  if (errorCount > 0 || (strict && warningCount > 0)) {
    // 默认只有 error 让脚本失败；--strict 会把 warning 也当成失败。
    process.exitCode = 1
  }
}

main()
  .then(() => {
    process.exit(process.exitCode || 0)
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
