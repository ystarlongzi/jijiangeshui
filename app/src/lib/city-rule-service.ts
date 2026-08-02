import 'server-only'

import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import config from '@payload-config'
import { adaptCmsPolicyToCityRule } from './city-rule-adapter'
import { cityRules, selectEffectiveCityRule, type CityRule } from './tax-rules'

type CityRuleMap = Record<string, CityRule>

export type CityRuleDatasetSource = 'payload' | 'fallback'
export type CityRuleSourceByCity = Record<string, CityRuleDatasetSource>

export type CityRuleDataset = {
  rules: CityRuleMap
  ruleSourcesByCity: CityRuleSourceByCity
  source: CityRuleDatasetSource
  fallbackCities: number
  cmsEnabledCities: number
  cmsPolicies: number
  cmsActivePolicyCities: number
  cmsMergedCities: number
  pendingIncluded: boolean
  fallbackReason?: string
}

export type CityRuleDatasetSummary = {
  sourceLabel: string
  sourceDetail: string
}

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

const DEFAULT_CITY_RULE_CACHE_SECONDS = 300

function canUsePendingRules() {
  return process.env.CITY_RULE_INCLUDE_PENDING === 'true' || process.env.NODE_ENV !== 'production'
}

function getCityRuleCacheSeconds() {
  const configured = Number(process.env.CITY_RULE_CACHE_SECONDS)
  if (Number.isFinite(configured) && configured >= 0) return configured
  return DEFAULT_CITY_RULE_CACHE_SECONDS
}

function hasSlug(city: CmsCityDoc): city is CmsCityDoc & { slug: string } {
  return typeof city.slug === 'string' && city.slug.trim() !== ''
}

export async function getAvailableCityRules(): Promise<CityRuleMap> {
  const dataset = await getAvailableCityRuleDataset()
  return dataset.rules
}

export async function getAvailableCityRuleDataset(): Promise<CityRuleDataset> {
  if (!process.env.DATABASE_URI) return createFallbackDataset('missing-database-uri')

  try {
    return await readCachedCityRulesFromPayload()
  } catch (error) {
    console.warn('读取 Payload 城市规则失败，已回退到内置规则。', error)
    return createFallbackDataset('payload-read-failed')
  }
}

export async function getAvailableCityRule(slug: string): Promise<CityRule | undefined> {
  const rules = await getAvailableCityRules()
  return rules[slug]
}

export function getCityRuleDatasetSummary(dataset: CityRuleDataset): CityRuleDatasetSummary {
  if (dataset.source === 'payload') {
    return {
      sourceLabel: 'Payload CMS',
      sourceDetail: dataset.pendingIncluded ? '已包含待审核规则' : '仅使用有效规则',
    }
  }

  return {
    sourceLabel: '内置兜底',
    sourceDetail: getFallbackReasonLabel(dataset.fallbackReason),
  }
}

async function readCachedCityRulesFromPayload() {
  const cacheSeconds = getCityRuleCacheSeconds()
  if (cacheSeconds === 0) return readCityRulesFromPayload()

  return unstable_cache(readCityRulesFromPayload, ['payload-city-rules'], {
    revalidate: cacheSeconds,
    tags: ['city-rules'],
  })()
}

async function readCityRulesFromPayload(): Promise<CityRuleDataset> {
  const payload = await getPayload({ config })
  const cityResult = await payload.find({
    collection: 'cities',
    depth: 0,
    limit: 1000,
    where: { enabled: { equals: true } },
  })
  const rules: CityRuleMap = { ...cityRules }
  const ruleSourcesByCity: CityRuleSourceByCity = Object.fromEntries(
    Object.keys(cityRules).map((city) => [city, 'fallback' as const]),
  )
  const cities = (cityResult.docs as CmsCityDoc[]).filter(hasSlug)
  const activePolicies = await readPoliciesByCity('active')
  const pendingIncluded = canUsePendingRules()
  const pendingPolicies = pendingIncluded ? await readPoliciesByCity('pendingReview') : createEmptyPolicySummary()
  let cmsMergedCities = 0

  for (const city of cities) {
    const cityId = String(city.id)
    const policies = activePolicies.byCity.get(cityId) || pendingPolicies.byCity.get(cityId) || []

    if (policies.length > 0) {
      const versions = policies.map((policy) => adaptCmsPolicyToCityRule(policy, city))
      const activeRule = selectEffectiveCityRule(versions, `${new Date().getFullYear()}-12-31`) || versions[0]
      if (activeRule) {
        rules[city.slug] = { ...activeRule, policyVersions: versions }
        ruleSourcesByCity[city.slug] = 'payload'
        cmsMergedCities += 1
      }
    }
  }

  return {
    rules,
    ruleSourcesByCity,
    source: 'payload',
    fallbackCities: Object.keys(cityRules).length,
    cmsEnabledCities: cities.length,
    cmsPolicies: activePolicies.count + pendingPolicies.count,
    cmsActivePolicyCities: activePolicies.byCity.size,
    cmsMergedCities,
    pendingIncluded,
  }

  async function readPoliciesByCity(policyStatus: CmsPolicyStatus) {
    const policyResult = await payload.find({
      collection: 'social-insurance-policies',
      depth: 0,
      draft: policyStatus === 'pendingReview',
      limit: 2000,
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

    return { byCity: grouped, count: policies.length }
  }
}

function createEmptyPolicySummary() {
  return { byCity: new Map<string, CmsPolicyDoc[]>(), count: 0 }
}

function createFallbackDataset(fallbackReason: string): CityRuleDataset {
  return {
    rules: cityRules,
    ruleSourcesByCity: Object.fromEntries(Object.keys(cityRules).map((city) => [city, 'fallback' as const])),
    source: 'fallback',
    fallbackCities: Object.keys(cityRules).length,
    cmsEnabledCities: 0,
    cmsPolicies: 0,
    cmsActivePolicyCities: 0,
    cmsMergedCities: 0,
    pendingIncluded: false,
    fallbackReason,
  }
}

function getFallbackReasonLabel(reason?: string) {
  if (reason === 'missing-database-uri') return '未配置数据库连接'
  if (reason === 'payload-read-failed') return 'CMS 读取失败'
  return 'CMS 未接入'
}

function getRelationId(value: CmsPolicyDoc['city']) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && (typeof value.id === 'string' || typeof value.id === 'number')) return String(value.id)
  return undefined
}
