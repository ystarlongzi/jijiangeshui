import 'server-only'

import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import config from '@payload-config'
import { adaptCmsPolicyToCityRule } from './city-rule-adapter'
import { canonicalCitySlug } from './city-slugs'
import { cityRules, selectEffectiveCityRule, type CityRule } from './tax-rules'
import type { CityRuleLoadStatus, CitySummary } from './city-rule-types'

const DEFAULT_CITY_RULE_CACHE_SECONDS = 300

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

type CityDirectoryEntry = CitySummary & {
  id: string | number
}

export type CityRuleLoadResult = CityRuleLoadStatus & {
  rule?: CityRule
}

export type GetCitiesOptions = {
  keyword?: string
  limit?: number
  all?: boolean
}

export async function getAvailableCities(options: GetCitiesOptions = {}): Promise<CitySummary[]> {
  const cities = process.env.DATABASE_URI
    ? await getCachedCityDirectory()
    : createFallbackCityDirectory()
  const keyword = options.keyword?.trim().toLocaleLowerCase('zh-CN') || ''
  const matchedCities = keyword
    ? cities.filter((city) => `${city.slug} ${city.name} ${city.label} ${city.province} ${city.pinyin}`.toLocaleLowerCase('zh-CN').includes(keyword))
    : cities

  const visibleCities = options.all ? matchedCities : matchedCities.slice(0, normalizeLimit(options.limit))
  return visibleCities.map(({ id: _id, ...city }) => city)
}

async function getAvailableCityEntry(slug: string): Promise<CityDirectoryEntry | undefined> {
  const normalizedSlug = normalizeSlug(slug)
  if (!normalizedSlug) return undefined
  const cities = process.env.DATABASE_URI
    ? await getCachedCityDirectory()
    : createFallbackCityDirectory()
  return cities.find((city) => city.slug === normalizedSlug)
}

export async function getAvailableCity(slug: string): Promise<CitySummary | undefined> {
  const city = await getAvailableCityEntry(slug)
  if (!city) return undefined
  const { id: _id, ...summary } = city
  return summary
}

export async function getAvailableCityRuleResult(slug: string): Promise<CityRuleLoadResult> {
  const normalizedSlug = normalizeSlug(slug)
  const city = normalizedSlug ? await getAvailableCityEntry(normalizedSlug) : undefined
  if (!city) return { source: 'fallback', fallbackReason: 'city-not-found' }

  const fallbackRule = cityRules[city.slug]
  if (!process.env.DATABASE_URI) {
    return fallbackRule
      ? { rule: fallbackRule, source: 'fallback', fallbackReason: 'missing-database-uri' }
      : { source: 'fallback', fallbackReason: 'missing-database-uri' }
  }

  try {
    const cmsRule = await getCachedCityRule(city)
    if (cmsRule) return { rule: cmsRule, source: 'payload' }
    return fallbackRule
      ? { rule: fallbackRule, source: 'fallback', fallbackReason: 'policy-not-found' }
      : { source: 'fallback', fallbackReason: 'policy-not-found' }
  } catch (error) {
    console.warn(`读取城市规则失败：${city.slug}，已回退到内置规则。`, error)
    return fallbackRule
      ? { rule: fallbackRule, source: 'fallback', fallbackReason: 'payload-read-failed' }
      : { source: 'fallback', fallbackReason: 'payload-read-failed' }
  }
}

export async function getAvailableCityRule(slug: string): Promise<CityRule | undefined> {
  const result = await getAvailableCityRuleResult(slug)
  return result.rule
}

async function getCachedCityDirectory(): Promise<CityDirectoryEntry[]> {
  const cacheSeconds = getCityRuleCacheSeconds()
  if (cacheSeconds === 0) return readCityDirectoryFromPayload()

  return unstable_cache(readCityDirectoryFromPayload, ['payload-city-directory'], {
    revalidate: cacheSeconds,
    tags: ['city-directory', 'city-rules'],
  })()
}

async function getCachedCityRule(city: CityDirectoryEntry): Promise<CityRule | undefined> {
  const cacheSeconds = getCityRuleCacheSeconds()
  if (cacheSeconds === 0) return readCityRuleFromPayload(city)

  return unstable_cache(() => readCityRuleFromPayload(city), ['payload-city-rule', city.slug], {
    revalidate: cacheSeconds,
    tags: ['city-rules', `city-rule:${city.slug}`],
  })()
}

async function readCityDirectoryFromPayload(): Promise<CityDirectoryEntry[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'cities',
    depth: 0,
    limit: 1000,
    sort: 'provinceName,name',
    where: { enabled: { equals: true } },
  })

  const entries = (result.docs as CmsCityDoc[])
    .filter(hasSlug)
    .map(toCitySummary)

  // 兼容 CMS 尚未完成 slug 回填的窗口；同一规范 slug 只保留一条目录项。
  return [...new Map(entries.map((entry) => [entry.slug, entry])).values()]
}

async function readCityRuleFromPayload(city: CityDirectoryEntry): Promise<CityRule | undefined> {
  const payload = await getPayload({ config })
  const activePolicies = await readPoliciesByStatus('active')
  const policies = activePolicies.length > 0 || !canUsePendingRules()
    ? activePolicies
    : await readPoliciesByStatus('pendingReview')

  if (policies.length === 0) return undefined

  const versions = policies.map((policy) => adaptCmsPolicyToCityRule(policy, toCmsCity(city)))
  return selectEffectiveCityRule(versions, `${new Date().getFullYear()}-12-31`) || versions[0]

  async function readPoliciesByStatus(policyStatus: CmsPolicyStatus) {
    const result = await payload.find({
      collection: 'social-insurance-policies',
      depth: 0,
      draft: policyStatus === 'pendingReview',
      limit: 2000,
      sort: '-effectiveFrom',
      where: {
        city: { equals: city.id },
        policyStatus: { equals: policyStatus },
      },
    })

    return result.docs as CmsPolicyDoc[]
  }
}

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

function toCitySummary(city: CmsCityDoc & { slug: string }): CityDirectoryEntry {
  const label = city.name || city.shortName || city.slug
  const slug = canonicalCitySlug(city.slug)
  return {
    id: city.id,
    slug,
    name: city.shortName || city.name || city.slug,
    label,
    province: city.provinceName || label,
    pinyin: slug,
  }
}

function toCmsCity(city: CityDirectoryEntry): CmsCityDoc & { slug: string } {
  return {
    id: city.id,
    name: city.label,
    slug: city.slug,
    provinceName: city.province,
    shortName: city.name,
  }
}

function createFallbackCityDirectory(): CityDirectoryEntry[] {
  return Object.entries(cityRules)
    .map(([slug, rule]) => ({
      id: slug,
      slug,
      name: rule.name,
      label: rule.label,
      province: rule.province,
      pinyin: rule.pinyin,
    }))
    .sort((prev, next) => prev.province.localeCompare(next.province, 'zh-CN') || prev.label.localeCompare(next.label, 'zh-CN'))
}

function normalizeLimit(value?: number) {
  const configuredLimit = Number.isFinite(value) ? Math.floor(value as number) : 20
  return Math.min(Math.max(configuredLimit, 1), 1000)
}

function normalizeSlug(value: string) {
  return canonicalCitySlug(value)
}
