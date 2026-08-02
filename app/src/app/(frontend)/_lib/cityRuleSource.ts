export type FrontendCityRuleSource = 'payload' | 'fallback'

export type FrontendCityRuleDatasetSummary = {
  sourceLabel: string
  sourceDetail: string
}

export type FrontendCityRuleSourceCounts = Record<FrontendCityRuleSource, number>

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

export function countCityRuleSources(cityKeys: Iterable<string>, ruleSourcesByCity: Record<string, FrontendCityRuleSource> = {}): FrontendCityRuleSourceCounts {
  const counts: FrontendCityRuleSourceCounts = { fallback: 0, payload: 0 }

  for (const cityKey of cityKeys) {
    const source = ruleSourcesByCity[cityKey] || 'fallback'
    counts[source] += 1
  }

  return counts
}
