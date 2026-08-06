export type CitySummary = {
  slug: string
  name: string
  label: string
  province: string
  pinyin: string
}

export type CityRuleSource = 'payload' | 'fallback'

export type CityRuleLoadStatus = {
  source: CityRuleSource
  fallbackReason?: string
}
