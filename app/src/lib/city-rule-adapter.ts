import type {
  CityRule,
  ContributionBaseRule,
  ContributionBaseType,
  ContributionCalcMethod,
  ContributionItemRule,
  ContributionSideRule,
  ContributionSource,
  ContributionSystemType,
} from './tax-rules'
import { contributionBaseLabels, housingRateOptions } from './tax-rules'

type CmsCity = {
  name?: string | null
  slug?: string | null
  provinceName?: string | null
  shortName?: string | null
}

type CmsContributionBaseRule = {
  baseType?: string | null
  baseMin?: number | null
  baseMax?: number | null
}

type CmsContributionSideRule = {
  calcMethod?: string | null
  rate?: number | null
  fixedAmount?: number | null
}

type CmsContributionItemRule = {
  systemType?: string | null
  itemCode?: string | null
  itemName?: string | null
  baseType?: string | null
  employee?: CmsContributionSideRule | null
  employer?: CmsContributionSideRule | null
  sortOrder?: number | null
}

type CmsContributionSource = {
  title?: string | null
  url?: string | null
  checkedAt?: string | null
  remark?: string | null
}

type CmsSocialInsurancePolicy = {
  policyYear?: number | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  source?: CmsContributionSource | null
  baseRules?: CmsContributionBaseRule[] | null
  itemRules?: CmsContributionItemRule[] | null
}

const contributionCalcMethods: ContributionCalcMethod[] = ['none', 'rate', 'fixed', 'ratePlusFixed']

function isBaseType(value: unknown): value is ContributionBaseType {
  return typeof value === 'string' && value.trim() !== '' && value !== 'none'
}

function isSystemType(value: unknown): value is ContributionSystemType {
  return value === 'social' || value === 'housingFund'
}

function normalizeCalcMethod(value: unknown): ContributionCalcMethod {
  return contributionCalcMethods.includes(value as ContributionCalcMethod) ? (value as ContributionCalcMethod) : 'none'
}

function normalizePercentRate(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value <= 1 ? value * 100 : value
}

function normalizeMoney(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeSideRule(rule: CmsContributionSideRule | null | undefined): ContributionSideRule {
  return {
    method: normalizeCalcMethod(rule?.calcMethod),
    rate: normalizePercentRate(rule?.rate),
    fixedAmount: normalizeMoney(rule?.fixedAmount),
  }
}

function normalizeSource(source: CmsContributionSource | null | undefined, effective: string): ContributionSource {
  return {
    title: source?.title || '社保公积金规则依据',
    url: source?.url || undefined,
    checkedAt: source?.checkedAt || effective,
  }
}

function createFallbackBaseRule(type: ContributionBaseType): ContributionBaseRule {
  return {
    type,
    label: contributionBaseLabels[type as keyof typeof contributionBaseLabels] || `${type}缴费基数`,
    min: 0,
    max: 0,
  }
}

function normalizeBaseRules(baseRules: CmsContributionBaseRule[] | null | undefined) {
  const normalized: Record<string, ContributionBaseRule> = {
    social: createFallbackBaseRule('social'),
    housingFund: createFallbackBaseRule('housingFund'),
  }

  for (const rule of baseRules || []) {
    if (!isBaseType(rule.baseType)) continue
    normalized[rule.baseType] = {
      type: rule.baseType,
      label: contributionBaseLabels[rule.baseType as keyof typeof contributionBaseLabels] || `${rule.baseType}缴费基数`,
      min: normalizeMoney(rule.baseMin) ?? 0,
      max: normalizeMoney(rule.baseMax) ?? 0,
    }
  }

  return normalized
}

function normalizeContributionItems(itemRules: CmsContributionItemRule[] | null | undefined): ContributionItemRule[] {
  return [...(itemRules || [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .flatMap((item, index) => {
      if (!isSystemType(item.systemType) || !isBaseType(item.baseType)) return []
      const code = item.itemCode || `unknown-${index + 1}`

      return {
        code,
        name: item.itemName || `未命名项目 ${index + 1}`,
        systemType: item.systemType,
        baseType: item.baseType,
        employee: normalizeSideRule(item.employee),
        employer: normalizeSideRule(item.employer),
        housing: item.systemType === 'housingFund' || code === 'housing-fund',
      }
    })
}

export function adaptCmsPolicyToCityRule(policy: CmsSocialInsurancePolicy, city: CmsCity): CityRule {
  const effective = policy.effectiveFrom || `${policy.policyYear || new Date().getFullYear()}-01-01`
  const baseRules = normalizeBaseRules(policy.baseRules)
  const contributionItems = normalizeContributionItems(policy.itemRules)
  const pensionRule = contributionItems.find((item) => item.code === 'pension')
  const medicalRule = contributionItems.find((item) => item.code === 'medical')

  return {
    name: city.shortName || city.name || city.slug || '未知城市',
    label: city.name || city.shortName || '未知城市',
    province: city.provinceName || city.name || '未知省份',
    pinyin: city.slug || 'unknown-city',
    effective,
    effectiveTo: policy.effectiveTo || undefined,
    baseRules,
    contributionItems,
    housingRateOptions,
    sources: [normalizeSource(policy.source, effective)],
    socialMin: baseRules.social.min,
    socialMax: baseRules.social.max,
    housingMin: baseRules.housingFund.min,
    housingMax: baseRules.housingFund.max,
    socialEmployee: pensionRule?.employee.rate ?? 0,
    socialEmployer: pensionRule?.employer.rate ?? 0,
    medicalEmployee: medicalRule?.employee.rate ?? 0,
    medicalEmployer: medicalRule?.employer.rate ?? 0,
  }
}
