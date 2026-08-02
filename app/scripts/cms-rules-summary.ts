import fs from 'node:fs/promises'
import path from 'node:path'

import { getPayload, type Where } from 'payload'

type CmsCityDoc = {
  id: string | number
  slug?: string | null
  name?: string | null
  provinceName?: string | null
  enabled?: boolean | null
}

type CmsPolicyDoc = {
  id: string | number
  city?: string | number | { id?: string | number | null; name?: string | null; slug?: string | null } | null
  policyTitle?: string | null
  policyYear?: number | null
  policyStatus?: 'pendingReview' | 'active' | 'archived' | null
  effectiveFrom?: string | null
  source?: {
    title?: string | null
    url?: string | null
    checkedAt?: string | null
  } | null
  warnings?: Array<{ message?: string | null }> | null
}

const useJson = process.argv.includes('--json')

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

function summarizeStatus(policies: CmsPolicyDoc[]) {
  return policies.reduce(
    (summary, policy) => {
      const status = policy.policyStatus || 'pendingReview'
      summary[status] += 1
      return summary
    },
    { pendingReview: 0, active: 0, archived: 0 },
  )
}

function toPercent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

async function main() {
  await loadLocalEnv()

  if (!process.env.DATABASE_URI) {
    throw new Error('缺少 DATABASE_URI。请确认 app/.env 已配置并且 PostgreSQL 已启动。')
  }

  const policyYear = parsePositiveInteger(getFlagValue('--policy-year'), '--policy-year')
  const policyFilters: Where[] = []
  if (policyYear) policyFilters.push({ policyYear: { equals: policyYear } })
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })

  try {
    const [cityResult, policyResult] = await Promise.all([
      payload.find({ collection: 'cities', depth: 0, limit: 1000 }),
      payload.find({
        collection: 'social-insurance-policies',
        depth: 1,
        limit: 2000,
        sort: '-effectiveFrom',
        where: policyFilters.length ? { and: policyFilters } : undefined,
      }),
    ])

    const cities = cityResult.docs as CmsCityDoc[]
    const policies = policyResult.docs as CmsPolicyDoc[]
    const cityById = new Map(cities.map((city) => [String(city.id), city]))
    const activePolicies = policies.filter((policy) => policy.policyStatus === 'active')
    const activeCityIds = new Set(activePolicies.map((policy) => getRelationId(policy.city)).filter(Boolean))
    const sourceCount = policies.filter((policy) => policy.source?.url).length
    const checkedCount = policies.filter((policy) => policy.source?.checkedAt).length
    const warningCount = policies.reduce((total, policy) => total + (policy.warnings?.length || 0), 0)
    const status = summarizeStatus(policies)
    const enabledCities = cities.filter((city) => city.enabled !== false)
    const missingActiveCityNames = enabledCities
      .filter((city) => !activeCityIds.has(String(city.id)))
      .map((city) => city.name || city.slug || String(city.id))
    const missingActiveCities = missingActiveCityNames
      .slice(0, 20)

    const summary = {
      policyYear: policyYear || 'all',
      cities: cities.length,
      enabledCities: enabledCities.length,
      policies: policies.length,
      status,
      activePolicyCities: activeCityIds.size,
      missingActiveCityCount: missingActiveCityNames.length,
      activeCoverageRate: enabledCities.length ? Number((activeCityIds.size / enabledCities.length).toFixed(4)) : 0,
      activeCoveragePercent: toPercent(activeCityIds.size, enabledCities.length),
      policiesWithSourceUrl: sourceCount,
      sourceUrlCoveragePercent: toPercent(sourceCount, policies.length),
      policiesWithCheckedDate: checkedCount,
      checkedDateCoveragePercent: toPercent(checkedCount, policies.length),
      warnings: warningCount,
      missingActiveCities,
      orphanActivePolicies: activePolicies
        .filter((policy) => {
          const cityId = getRelationId(policy.city)
          return !cityId || !cityById.has(cityId)
        })
        .length,
    }

    if (useJson) {
      console.log(JSON.stringify(summary, null, 2))
      return
    }

    console.log(`Payload CMS 社保公积金规则概览${policyYear ? `（${policyYear}）` : ''}`)
    console.log(`城市：${summary.enabledCities}/${summary.cities} 个启用`)
    console.log(`政策：${summary.policies} 条，待审核 ${status.pendingReview}，有效 ${status.active}，已归档 ${status.archived}`)
    console.log(`有效规则覆盖：${summary.activePolicyCities}/${summary.enabledCities} 个启用城市（${summary.activeCoveragePercent}%）`)
    console.log(`来源链接：${sourceCount}/${summary.policies}（${summary.sourceUrlCoveragePercent}%），核对日期：${checkedCount}/${summary.policies}（${summary.checkedDateCoveragePercent}%），解析警告：${warningCount}`)

    if (summary.orphanActivePolicies > 0) {
      console.log(`提醒：${summary.orphanActivePolicies} 条有效政策没有匹配到城市。`)
    }

    if (missingActiveCities.length) {
      console.log(`未覆盖有效规则城市：${summary.missingActiveCityCount} 个，示例：${missingActiveCities.join('、')}${summary.missingActiveCityCount > missingActiveCities.length ? ' ...' : ''}`)
    }
  } finally {
    await payload.destroy()
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 0)
  })
