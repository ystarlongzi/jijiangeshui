import { currentYear, siteName } from './site'

export type TaxRateIdentity = 'resident' | 'non-resident'
export type TaxRateIncomeType = 'salary' | 'labor' | 'royalty' | 'license' | 'business' | 'rent' | 'transfer' | 'dividend' | 'accidental'
export type TaxRateSelection = { type: TaxRateIncomeType; identity: TaxRateIdentity; year: number }
export type TaxRateSearchParams = Record<string, string | string[] | undefined>

export const classifiedTaxRateTypes: TaxRateIncomeType[] = ['business', 'rent', 'transfer', 'dividend', 'accidental']

export const taxRateIncomeLabels: Record<TaxRateIncomeType, string> = {
  salary: '工资薪金',
  labor: '劳务报酬',
  royalty: '稿酬所得',
  license: '特许权使用费',
  business: '经营所得',
  rent: '财产租赁所得',
  transfer: '财产转让所得',
  dividend: '利息、股息、红利所得',
  accidental: '偶然所得',
}

const validTaxRateTypes = Object.keys(taxRateIncomeLabels) as TaxRateIncomeType[]
const validTaxRateIdentities: TaxRateIdentity[] = ['resident', 'non-resident']

export function isClassifiedTaxRateType(type: TaxRateIncomeType) {
  return classifiedTaxRateTypes.includes(type)
}

function readSearchParam(searchParams: TaxRateSearchParams, key: string) {
  const value = searchParams[key]
  return Array.isArray(value) ? value[0] : value
}

export function parseTaxRateSelection(searchParams: TaxRateSearchParams = {}, availableYears?: number[]): TaxRateSelection {
  const defaultYear = availableYears?.[0] || currentYear
  const requestedType = readSearchParam(searchParams, 'type')
  const requestedIdentity = readSearchParam(searchParams, 'identity')
  const requestedYear = Number(readSearchParam(searchParams, 'year'))
  const type = requestedType && validTaxRateTypes.includes(requestedType as TaxRateIncomeType) ? requestedType as TaxRateIncomeType : 'salary'
  const identity = requestedIdentity && validTaxRateIdentities.includes(requestedIdentity as TaxRateIdentity) ? requestedIdentity as TaxRateIdentity : 'resident'
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 && (!availableYears?.length || availableYears.includes(requestedYear))
    ? requestedYear
    : defaultYear

  return { type, identity: isClassifiedTaxRateType(type) ? 'resident' : identity, year }
}

export function getTaxRateLabel(selection: Pick<TaxRateSelection, 'type' | 'identity'>) {
  const identityLabel = isClassifiedTaxRateType(selection.type) ? '' : selection.identity === 'non-resident' ? '非居民个人' : '居民个人'
  return `${identityLabel}${taxRateIncomeLabels[selection.type]}`
}

export function getTaxRatePageSeo(selection: TaxRateSelection) {
  const label = getTaxRateLabel(selection)
  const isDefault = selection.type === 'salary' && selection.identity === 'resident' && selection.year === currentYear
  return {
    title: isDefault ? `税率表｜${selection.year}年个人所得税预扣规则｜${siteName}` : `${selection.year}年${label}税率表｜个人所得税预扣规则｜${siteName}`,
    description: `${selection.year}年${label}适用的个人所得税税率、预扣率、速算扣除数和计税规则。最终结果以官方政策和扣缴单位口径为准。`,
    heading: isDefault ? '税率表' : `${selection.year}年${label}税率表`,
  }
}

export function getTaxRateUrl(selection: TaxRateSelection, defaultYear = currentYear) {
  const isDefault = selection.type === 'salary' && selection.identity === 'resident' && selection.year === defaultYear
  if (isDefault) return '/tax-rate'

  const params = new URLSearchParams()
  params.set('type', selection.type)
  if (!isClassifiedTaxRateType(selection.type)) params.set('identity', selection.identity)
  // 具体 tab URL 始终保留年度，便于分享、刷新和搜索引擎区分历史规则。
  params.set('year', String(selection.year))
  return `/tax-rate?${params.toString()}`
}

/**
 * 生成税率页需要被搜索引擎发现的入口集合：综合所得包含居民/非居民两套规则，
 * 分类所得只有一个身份维度。sitemap 和页面上的真实 href 共用这套选择口径。
 */
export function getTaxRateSeoSelections(year: number): TaxRateSelection[] {
  const comprehensiveTypes: TaxRateIncomeType[] = ['salary', 'labor', 'royalty', 'license']
  const classifiedTypes: TaxRateIncomeType[] = ['business', 'rent', 'transfer', 'dividend', 'accidental']

  return [
    ...comprehensiveTypes.flatMap((type) => [
      { type, identity: 'resident' as const, year },
      { type, identity: 'non-resident' as const, year },
    ]),
    ...classifiedTypes.map((type) => ({ type, identity: 'resident' as const, year })),
  ]
}
