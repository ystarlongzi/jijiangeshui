import type { CityRule } from '@/lib/tax-rules'

export type FrontendCityRuleSource = 'payload' | 'fallback'

export type FrontendCityRuleDatasetSummary = {
  sourceLabel: string
  sourceDetail: string
}

export type FrontendCityRuleSourceCounts = Record<FrontendCityRuleSource, number>

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
      ? ruleDatasetSummary?.sourceDetail || '已使用后台有效规则'
      : ruleDatasetSummary?.sourceLabel === '内置兜底'
        ? ruleDatasetSummary.sourceDetail
        : '当前城市暂无后台有效规则',
    label: isPayload ? 'Payload CMS' : '内置兜底',
    source,
  }
}

export function getCityRuleSourceBadgeLabel(source: FrontendCityRuleSource) {
  return source === 'payload' ? 'CMS' : '兜底'
}

export function countCityRuleSources(cityKeys: Iterable<string>, ruleSourcesByCity: Record<string, FrontendCityRuleSource> = {}): FrontendCityRuleSourceCounts {
  const counts: FrontendCityRuleSourceCounts = { fallback: 0, payload: 0 }

  for (const cityKey of cityKeys) {
    const source = ruleSourcesByCity[cityKey] || 'fallback'
    counts[source] += 1
  }

  return counts
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
