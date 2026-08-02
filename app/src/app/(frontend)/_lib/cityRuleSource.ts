import type { CityRule } from '@/lib/tax-rules'

export type FrontendCityRuleSource = 'payload' | 'fallback'

export type FrontendCityRuleDatasetSummary = {
  sourceLabel: string
  sourceDetail: string
}

export type FrontendCityRuleSourceCounts = Record<FrontendCityRuleSource, number>

export type FrontendCityRuleSourceCoverage = FrontendCityRuleSourceCounts & {
  payloadRate: number
  total: number
}

export type FrontendCityRuleLinkItem = {
  key: string
  label: string
  sourceLabel: string
  sourceType: FrontendCityRuleSource
}

type CityRuleSourceStatusInput = {
  city: string
  ruleSourcesByCity?: Record<string, FrontendCityRuleSource>
  ruleDatasetSummary?: FrontendCityRuleDatasetSummary
}

export function getCityRuleSourceStatus({ city, ruleSourcesByCity = {}, ruleDatasetSummary }: CityRuleSourceStatusInput) {
  const source = ruleSourcesByCity[city] || 'fallback'
  const isPayload = source === 'payload'

  return {
    detail: isPayload
      ? '已收录城市规则'
      : isFallbackDataset(ruleDatasetSummary?.sourceLabel)
        ? '使用默认城市规则'
        : '当前城市规则待补充',
    label: isPayload ? '已收录规则' : '规则待补',
    source,
  }
}

function isFallbackDataset(sourceLabel?: string) {
  return sourceLabel === '内置兜底' || sourceLabel === '默认规则'
}

export function getCityRuleSourceBadgeLabel(source: FrontendCityRuleSource) {
  return source === 'payload' ? '已收录' : '待补'
}

export function countCityRuleSources(cityKeys: Iterable<string>, ruleSourcesByCity: Record<string, FrontendCityRuleSource> = {}): FrontendCityRuleSourceCounts {
  const counts: FrontendCityRuleSourceCounts = { fallback: 0, payload: 0 }

  for (const cityKey of cityKeys) {
    const source = ruleSourcesByCity[cityKey] || 'fallback'
    counts[source] += 1
  }

  return counts
}

export function getCityRuleSourceCoverage(cityKeys: Iterable<string>, ruleSourcesByCity: Record<string, FrontendCityRuleSource> = {}): FrontendCityRuleSourceCoverage {
  const counts = countCityRuleSources(cityKeys, ruleSourcesByCity)
  const total = counts.payload + counts.fallback

  return {
    ...counts,
    payloadRate: total > 0 ? Math.round(counts.payload / total * 100) : 0,
    total,
  }
}

type PreferredCityRuleLinksInput = {
  preferredCityKeys: readonly string[]
  ruleDatasetSummary?: FrontendCityRuleDatasetSummary
  ruleSourcesByCity?: Record<string, FrontendCityRuleSource>
  rules: Record<string, CityRule>
}

export function getPreferredCityRuleLinks({
  preferredCityKeys,
  ruleDatasetSummary,
  ruleSourcesByCity,
  rules,
}: PreferredCityRuleLinksInput): FrontendCityRuleLinkItem[] {
  return preferredCityKeys
    .map((key) => {
      const rule = rules[key]
      if (!rule) return null
      const sourceStatus = getCityRuleSourceStatus({
        city: key,
        ruleDatasetSummary,
        ruleSourcesByCity,
      })

      return {
        key,
        label: rule.label,
        sourceLabel: getCityRuleSourceBadgeLabel(sourceStatus.source),
        sourceType: sourceStatus.source,
      }
    })
    .filter((city): city is FrontendCityRuleLinkItem => Boolean(city))
}
