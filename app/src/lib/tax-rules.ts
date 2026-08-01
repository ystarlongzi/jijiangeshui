import { defaultHousingRateOptions, fallbackCityRuleConfigs, type CityRuleConfig } from './city-rule-data'

export type ContributionBaseType = 'social' | 'housingFund'

export type ContributionSystemType = 'social' | 'housingFund'

export type ContributionCalcMethod = 'none' | 'rate' | 'fixed' | 'ratePlusFixed'

export type ContributionSideRule = {
  method: ContributionCalcMethod
  rate?: number
  fixedAmount?: number
}

export type ContributionBaseRule = {
  type: ContributionBaseType
  label: string
  min: number
  max: number
}

export type ContributionItemRule = {
  code: string
  name: string
  systemType: ContributionSystemType
  baseType: ContributionBaseType
  employee: ContributionSideRule
  employer: ContributionSideRule
  housing?: boolean
}

export type ContributionSource = {
  title: string
  publisher?: string
  url?: string
  checkedAt?: string
}

export type CityRule = {
  name: string
  label: string
  province: string
  pinyin: string
  effective: string
  effectiveTo?: string
  baseRules: Record<ContributionBaseType, ContributionBaseRule>
  contributionItems: ContributionItemRule[]
  housingRateOptions: number[]
  sources: ContributionSource[]
  policyVersions?: CityRule[]
  socialMin: number
  socialMax: number
  housingMin: number
  housingMax: number
  socialEmployee: number
  socialEmployer: number
  medicalEmployee: number
  medicalEmployer: number
}

function rate(percent: number): ContributionSideRule {
  return { method: 'rate', rate: percent }
}

function none(): ContributionSideRule {
  return { method: 'none' }
}

function createCityRule(config: CityRuleConfig): CityRule {
  const defaultHousingRate = defaultHousingRateOptions[defaultHousingRateOptions.length - 1] || 12
  const baseRules: CityRule['baseRules'] = {
    social: { type: 'social', label: '社保缴费基数', min: config.socialMin, max: config.socialMax },
    housingFund: { type: 'housingFund', label: '公积金缴费基数', min: config.housingMin, max: config.housingMax },
  }

  return {
    ...config,
    baseRules,
    housingRateOptions: defaultHousingRateOptions,
    sources: config.sources || [{ title: `${config.label}社保、公积金规则待接入官方来源`, checkedAt: config.effective }],
    contributionItems: [
      { code: 'pension', name: '养老保险', systemType: 'social', baseType: 'social', employee: rate(config.socialEmployee), employer: rate(config.socialEmployer) },
      { code: 'medical', name: '医疗保险', systemType: 'social', baseType: 'social', employee: rate(config.medicalEmployee), employer: rate(config.medicalEmployer) },
      { code: 'unemployment', name: '失业保险', systemType: 'social', baseType: 'social', employee: rate(0.5), employer: rate(0.5) },
      { code: 'injury', name: '工伤保险', systemType: 'social', baseType: 'social', employee: none(), employer: rate(0.2) },
      { code: 'maternity', name: '生育保险', systemType: 'social', baseType: 'social', employee: none(), employer: rate(0.8) },
      { code: 'housing-fund', name: '公积金', systemType: 'housingFund', baseType: 'housingFund', employee: rate(defaultHousingRate), employer: rate(defaultHousingRate), housing: true },
    ],
  }
}

export const cityRules: Record<string, CityRule> = Object.fromEntries(
  Object.entries(fallbackCityRuleConfigs).map(([code, config]) => [code, createCityRule(config)]),
)

export const housingRateOptions = defaultHousingRateOptions

export function getContributionBaseRule(rule: CityRule, type: ContributionBaseType) {
  return rule.baseRules[type]
}

export function getHousingRateOptions(rule: CityRule) {
  return rule.housingRateOptions
}

export function getCityRuleForMonth(rule: CityRule, year: number, month: number) {
  const normalizedMonth = Math.max(1, Math.min(12, Math.trunc(month || 1)))
  return selectEffectiveCityRule([rule, ...(rule.policyVersions || [])], `${year}-${String(normalizedMonth).padStart(2, '0')}-01`) || rule
}

export function selectEffectiveCityRule(rules: CityRule[], targetDate: string) {
  const sortedRules = [...rules]
    .filter((rule) => rule.effective)
    .sort((a, b) => b.effective.localeCompare(a.effective))

  return sortedRules.find((rule) => rule.effective <= targetDate && (!rule.effectiveTo || rule.effectiveTo >= targetDate)) || sortedRules[0]
}

export const taxBrackets = [
  { ceiling: 36000, rate: 0.03, quick: 0 },
  { ceiling: 144000, rate: 0.1, quick: 2520 },
  { ceiling: 300000, rate: 0.2, quick: 16920 },
  { ceiling: 420000, rate: 0.25, quick: 31920 },
  { ceiling: 660000, rate: 0.3, quick: 52920 },
  { ceiling: 960000, rate: 0.35, quick: 85920 },
  { ceiling: Infinity, rate: 0.45, quick: 181920 },
]

export const deductionOptions = [
  { label: '子女教育', amount: 2000 },
  { label: '3 岁以下婴幼儿照护', amount: 2000 },
  { label: '住房租金', amount: 1500 },
  { label: '赡养老人', amount: 3000 },
]
