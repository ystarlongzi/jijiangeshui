import {
  wrappedPolicySchema,
  type CrawlCity,
  type CrawlPolicy,
  type CrawlPolicyEntry,
  type WrappedPolicy,
} from './city-rule-import-schema'

type NormalizedContributionSideRule = {
  calcMethod: NormalizedCalcMethod
  rate: number | null
  fixedAmount: number | null
}

type NormalizedContributionItemRule = {
  systemType: NormalizedSystemType
  itemCode: string
  itemName: string
  baseType: NormalizedItemBaseType
  employee: NormalizedContributionSideRule
  employer: NormalizedContributionSideRule
  sortOrder: number
}

type NormalizedPolicySource = {
  title: string
  url?: string | null
  checkedAt?: string | null
  remark?: string | null
}

export type NormalizedCmsPolicy = {
  policyYear: number
  effectiveFrom: string
  source: NormalizedPolicySource
  baseRules: Array<{
    baseType: NormalizedBaseType
    baseMin: number
    baseMax: number
  }>
  itemRules: NormalizedContributionItemRule[]
}

export type NormalizedAuditCity = {
  name?: string
  slug: string
  provinceName?: string
  shortName?: string
}

export function numberOrNull(value: unknown) {
  // 外部采集数据可能出现空字符串、null 或缺字段；统一转成后台字段可接受的 number/null。
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function stringOrUndefined(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

const normalizedBaseTypes = ['social', 'housingFund', 'pension', 'medical', 'unemployment', 'injury', 'maternity'] as const
const normalizedItemBaseTypes = [...normalizedBaseTypes, 'none'] as const
const normalizedSystemTypes = ['social', 'housingFund', 'employerCost'] as const
const normalizedCalcMethods = ['none', 'rate', 'fixed', 'ratePlusFixed'] as const

type NormalizedBaseType = (typeof normalizedBaseTypes)[number]
type NormalizedItemBaseType = (typeof normalizedItemBaseTypes)[number]
type NormalizedSystemType = (typeof normalizedSystemTypes)[number]
type NormalizedCalcMethod = (typeof normalizedCalcMethods)[number]

function normalizeEnumValue<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]) {
  return options.includes(value as T[number]) ? (value as T[number]) : fallback
}

export function slugifyRuleEntity(city: CrawlCity | CrawlPolicy) {
  // 优先使用 areaCode/areaId 这类稳定标识；没有时才退回城市名。
  // 生成的 slug 需要和城市集合中的 slug 保持一致，政策导入和审计都会靠它关联城市。
  const source = ('areaCode' in city ? city.areaCode : undefined) || city.areaId || city.areaName || 'unknown-city'
  return String(source)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isWrappedPolicyEntry(entry: CrawlPolicyEntry): entry is WrappedPolicy {
  // 兼容两种输入：直接 policy 对象，或 { policy, ...meta } 包裹对象。
  return wrappedPolicySchema.safeParse(entry).success
}

export function normalizePolicyEntry(entry: CrawlPolicyEntry): CrawlPolicy {
  return isWrappedPolicyEntry(entry) ? entry.policy : entry
}

export function normalizeContributionItemRule(item: Record<string, unknown>, index: number): NormalizedContributionItemRule {
  // 把采集端的扁平字段转换成 Payload collection 里的 employee/employer 嵌套结构。
  // systemType 会影响默认基数类型：公积金使用 housingFund，企业成本不参与个人基数计算。
  const systemType = stringOrUndefined(item.systemType)
  const explicitBaseType = stringOrUndefined(item.baseType)
  const normalizedSystemType = normalizeEnumValue(systemType, normalizedSystemTypes, 'social')

  return {
    systemType: normalizedSystemType,
    itemCode: stringOrUndefined(item.itemCode) || `unknown-${index + 1}`,
    itemName: stringOrUndefined(item.itemName) || `未命名项目 ${index + 1}`,
    baseType: normalizeEnumValue(
      explicitBaseType,
      normalizedItemBaseTypes,
      normalizedSystemType === 'housingFund' ? 'housingFund' : normalizedSystemType === 'employerCost' ? 'none' : 'social',
    ),
    employee: {
      calcMethod: normalizeEnumValue(stringOrUndefined(item.employeeCalcMethod), normalizedCalcMethods, 'none'),
      rate: numberOrNull(item.employeeRate),
      fixedAmount: numberOrNull(item.employeeFixedAmount),
    },
    employer: {
      calcMethod: normalizeEnumValue(stringOrUndefined(item.employerCalcMethod), normalizedCalcMethods, 'none'),
      rate: numberOrNull(item.employerRate),
      fixedAmount: numberOrNull(item.employerFixedAmount),
    },
    sortOrder: numberOrNull(item.sortOrder) ?? (index + 1) * 10,
  }
}

export function normalizePolicySource(policy: CrawlPolicy): NormalizedPolicySource {
  return {
    title: policy.source?.title || `${policy.areaName || '未知城市'}社保公积金规则来源待补充`,
    url: policy.source?.url,
    checkedAt: policy.source?.checkedAt || new Date().toISOString(),
    remark: policy.source?.remark,
  }
}

export function normalizePolicyForCms(policy: CrawlPolicy): NormalizedCmsPolicy {
  const policyYear = Number(policy.policyYear)

  return {
    policyYear,
    effectiveFrom: policy.effectiveFrom || `${policy.policyYear || new Date().getFullYear()}-01-01`,
    source: normalizePolicySource(policy),
    baseRules: (policy.baseRulesInfo?.list || []).map((rule) => ({
      baseType: normalizeEnumValue(stringOrUndefined(rule.baseType), normalizedBaseTypes, 'social'),
      baseMin: numberOrNull(rule.baseMin) ?? 0,
      baseMax: numberOrNull(rule.baseMax) ?? 0,
    })),
    itemRules: (policy.itemRulesInfo?.list || []).map(normalizeContributionItemRule),
  }
}

export function createAuditCity(policy: CrawlPolicy, city?: CrawlCity): NormalizedAuditCity {
  return {
    name: city?.areaName || policy.areaName,
    slug: city ? slugifyRuleEntity(city) : slugifyRuleEntity(policy),
    provinceName: city?.parentAreaName || policy.areaName,
    shortName: city?.shortName || policy.areaName,
  }
}
