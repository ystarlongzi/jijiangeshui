import fs from 'node:fs/promises'
import path from 'node:path'

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
  getRuleQualityStatus,
  type RuleQualityCategory,
  type RuleQualityIssue,
} from '../src/lib/city-rule-quality'
import { cityRules, type CityRule } from '../src/lib/tax-rules'

/**
 * 审计城市社保公积金规则。
 *
 * 默认检查写在代码里的 fallback cityRules，不访问数据库。
 * 也可以传入采集 JSON 文件，先转换成前台 CityRule，再使用同一套质量规则检查。
 *
 * 用法：
 * - npm run rules:audit                         审计前台 fallback cityRules
 * - npm run rules:audit -- ./data/hrwork.json   审计采集或导出的 JSON 文件
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
  status: 'ok' | 'warning' | 'error'
}

type AuditSource = {
  label: string
  entries: Array<[string, CityRule]>
}

const useJson = process.argv.includes('--json')
const strict = process.argv.includes('--strict')
const inputPath = process.argv.find((arg, index) => index > 1 && !arg.startsWith('-'))
let currentIssues: RuleQualityIssue[] = []

async function loadAuditSource(): Promise<AuditSource> {
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

function formatRange(min: number, max: number) {
  return `${min}-${max}`
}

function createRow(code: string, rule: CityRule, issues: RuleQualityIssue[]): AuditRow {
  const checkedAt = getPrimaryRuleSource(rule)?.checkedAt || ''

  return {
    code,
    city: rule.label,
    effective: rule.effective,
    checkedAt,
    socialBase: formatRange(rule.baseRules.social.min, rule.baseRules.social.max),
    housingBase: formatRange(rule.baseRules.housingFund.min, rule.baseRules.housingFund.max),
    housingRates: rule.housingRateOptions.map((rate) => `${rate}%`).join('/'),
    sources: rule.sources.length,
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
  const errorCount = currentIssues.filter((issue) => issue.severity === 'error').length
  const warningCount = currentIssues.filter((issue) => issue.severity === 'warning').length
  const categorySummary = currentIssues.reduce(
    (summary, issue) => {
      summary[issue.category] += 1
      return summary
    },
    { source: 0, baseRule: 0, itemRule: 0, housingRate: 0 } satisfies Record<RuleQualityCategory, number>,
  )

  if (useJson) {
    // JSON 输出方便后续接入 CI、报表或后台任务。
    console.log(
      JSON.stringify(
        {
          rows,
          issues: currentIssues,
          summary: {
            source: source.label,
            cities: rows.length,
            errors: errorCount,
            warnings: warningCount,
            categories: categorySummary,
          },
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`审计来源：${source.label}`)
    console.table(rows)
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

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
