import 'server-only'

import { getPayload } from 'payload'

import config from '@payload-config'
import { adaptCmsPolicyToCityRule } from './city-rule-adapter'
import { cityRules, selectEffectiveCityRule, type CityRule } from './tax-rules'

type CityRuleMap = Record<string, CityRule>

type CmsCityDoc = {
  id: string | number
  name?: string | null
  slug?: string | null
  provinceName?: string | null
  shortName?: string | null
}

type CmsPolicyStatus = 'active' | 'pendingReview'
type CmsPolicyDoc = Parameters<typeof adaptCmsPolicyToCityRule>[0] & {
  city?: string | number | { id?: string | number | null } | null
}

function canUsePendingRules() {
  return process.env.CITY_RULE_INCLUDE_PENDING === 'true' || process.env.NODE_ENV !== 'production'
}

function hasSlug(city: CmsCityDoc): city is CmsCityDoc & { slug: string } {
  return typeof city.slug === 'string' && city.slug.trim() !== ''
}

export async function getAvailableCityRules(): Promise<CityRuleMap> {
  if (!process.env.DATABASE_URI) return cityRules

  try {
    return await readCityRulesFromPayload()
  } catch (error) {
    console.warn('读取 Payload 城市规则失败，已回退到内置规则。', error)
    return cityRules
  }
}

export async function getAvailableCityRule(slug: string): Promise<CityRule | undefined> {
  const rules = await getAvailableCityRules()
  return rules[slug]
}

async function readCityRulesFromPayload(): Promise<CityRuleMap> {
  const payload = await getPayload({ config })
  const cityResult = await payload.find({
    collection: 'cities',
    depth: 0,
    limit: 500,
    where: { enabled: { equals: true } },
  })
  const rules: CityRuleMap = { ...cityRules }
  const cities = (cityResult.docs as CmsCityDoc[]).filter(hasSlug)
  const activePolicies = await readPoliciesByCity('active')
  const pendingPolicies = canUsePendingRules() ? await readPoliciesByCity('pendingReview') : new Map<string, CmsPolicyDoc[]>()

  for (const city of cities) {
    const cityId = String(city.id)
    const policies = activePolicies.get(cityId) || pendingPolicies.get(cityId) || []

    if (policies.length > 0) {
      const versions = policies.map((policy) => adaptCmsPolicyToCityRule(policy, city))
      const activeRule = selectEffectiveCityRule(versions, `${new Date().getFullYear()}-12-31`) || versions[0]
      if (activeRule) rules[city.slug] = { ...activeRule, policyVersions: versions }
    }
  }

  return rules

  async function readPoliciesByCity(policyStatus: CmsPolicyStatus) {
    const policyResult = await payload.find({
      collection: 'social-insurance-policies',
      depth: 0,
      draft: policyStatus === 'pendingReview',
      limit: 1000,
      sort: '-effectiveFrom',
      where: { policyStatus: { equals: policyStatus } },
    })
    const policies = policyResult.docs as CmsPolicyDoc[]
    const grouped = new Map<string, CmsPolicyDoc[]>()

    for (const policy of policies) {
      const cityId = getRelationId(policy.city)
      if (!cityId) continue
      grouped.set(cityId, [...(grouped.get(cityId) || []), policy])
    }

    return grouped
  }
}

function getRelationId(value: CmsPolicyDoc['city']) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && (typeof value.id === 'string' || typeof value.id === 'number')) return String(value.id)
  return undefined
}
