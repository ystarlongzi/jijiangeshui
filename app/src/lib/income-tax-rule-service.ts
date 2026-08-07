import 'server-only'

import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import config from '@payload-config'
import { currentYear } from './site'
import {
  createSpecialDeductionItems,
  specialDeductionGroups as fallbackDeductionGroups,
  type SpecialDeductionGroup,
} from './special-deductions'
import { taxBrackets as fallbackTaxBrackets, type TaxBracket } from './tax-rules'
import type { IncomeTaxIncomeType, IncomeTaxRateRule, IncomeTaxRuleDataset, IncomeTaxYearRules, IncomeTaxpayerIdentity } from './income-tax-rule-types'

const RULE_CACHE_SECONDS = 300

type CmsTaxRateRow = {
  rangeLabel?: string | null
  lowerBound?: number | null
  upperBound?: number | null
  rate?: number | null
  quickDeduction?: number | null
  sortOrder?: number | null
}

type CmsTaxRateDoc = {
  ruleYear?: number | null
  incomeCategory?: string | null
  incomeType?: string | null
  taxpayerIdentity?: string | null
  rateMode?: string | null
  flatRate?: number | null
  tableRows?: CmsTaxRateRow[] | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  source?: { checkedAt?: string | null } | null
}

type CmsSpecialDeductionDoc = {
  ruleYear?: number | null
  deductionType?: string | null
  monthlyAmount?: number | null
  allocationOptions?: Array<{
    label?: string | null
    monthlyAmount?: number | null
    description?: string | null
    sortOrder?: number | null
  }> | null
  conditions?: { summary?: string | null } | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  source?: { checkedAt?: string | null } | null
}

const deductionTypeByGroupKey: Record<string, string> = {
  children: 'childEducation',
  infant: 'infantCare',
  education: 'continuingEducation',
  loan: 'housingLoanInterest',
  rent: 'housingRent',
  elderly: 'elderlyCare',
}

const requiredTaxRateRules: Array<{ incomeType: IncomeTaxIncomeType; taxpayerIdentity: IncomeTaxpayerIdentity; label: string }> = [
  { incomeType: 'salary', taxpayerIdentity: 'resident', label: '居民工资薪金' },
  { incomeType: 'salary', taxpayerIdentity: 'nonResident', label: '非居民工资薪金' },
  { incomeType: 'labor', taxpayerIdentity: 'resident', label: '居民劳务报酬' },
  { incomeType: 'labor', taxpayerIdentity: 'nonResident', label: '非居民劳务报酬' },
  { incomeType: 'author', taxpayerIdentity: 'resident', label: '居民稿酬' },
  { incomeType: 'author', taxpayerIdentity: 'nonResident', label: '非居民稿酬' },
  { incomeType: 'license', taxpayerIdentity: 'resident', label: '居民特许权使用费' },
  { incomeType: 'license', taxpayerIdentity: 'nonResident', label: '非居民特许权使用费' },
  { incomeType: 'business', taxpayerIdentity: 'notApplicable', label: '经营所得' },
  { incomeType: 'rental', taxpayerIdentity: 'notApplicable', label: '财产租赁所得' },
  { incomeType: 'transfer', taxpayerIdentity: 'notApplicable', label: '财产转让所得' },
  { incomeType: 'dividend', taxpayerIdentity: 'notApplicable', label: '利息股息红利所得' },
  { incomeType: 'accidental', taxpayerIdentity: 'notApplicable', label: '偶然所得' },
]

export async function getIncomeTaxRuleDataset(): Promise<IncomeTaxRuleDataset> {
  if (!process.env.DATABASE_URI) return createUnavailableDataset('missing-database-uri')

  try {
    const cacheSeconds = Number(process.env.INCOME_TAX_RULE_CACHE_SECONDS)
    const revalidate = Number.isFinite(cacheSeconds) && cacheSeconds >= 0 ? cacheSeconds : RULE_CACHE_SECONDS

    // 规则查询放进 Next 缓存，避免每个页面构建时都新建一组 Payload/Postgres 连接。
    if (revalidate === 0) return await readIncomeTaxRulesFromPayload()
    return await unstable_cache(readIncomeTaxRulesFromPayload, ['payload-income-tax-rules'], {
      revalidate,
      tags: ['income-tax-rules'],
    })()
  } catch (error) {
    console.warn('读取 Payload 税率/专项扣除规则失败，计算器将停止估算。', error)
    return createUnavailableDataset('payload-read-failed')
  }
}

async function readIncomeTaxRulesFromPayload(): Promise<IncomeTaxRuleDataset> {
  const payload = await getPayload({ config })
  const [taxRateResult, deductionResult] = await Promise.all([
    payload.find({
      collection: 'tax-rate-rules',
      depth: 0,
      limit: 2000,
      where: { ruleStatus: { equals: 'active' } },
    }),
    payload.find({
      collection: 'special-deduction-rules',
      depth: 0,
      limit: 2000,
      where: { ruleStatus: { equals: 'active' } },
    }),
  ])

  const taxDocs = taxRateResult.docs as CmsTaxRateDoc[]
  const deductionDocs = deductionResult.docs as CmsSpecialDeductionDoc[]
  const years = new Set<number>([
    ...taxDocs.map((doc) => doc.ruleYear).filter(isYear),
    ...deductionDocs.map((doc) => doc.ruleYear).filter(isYear),
  ])

  // 没有任何 CMS 年度数据时仍返回一个可渲染的静态结构，但标记为 fallback；
  // 客户端会据此展示阻断提示，而不是把静态值伪装成已审核的 CMS 规则。
  if (years.size === 0) years.add(currentYear)

  const availableYears = [...years].sort((a, b) => b - a)
  const rulesByYear = Object.fromEntries(availableYears.map((year) => [
    String(year), buildYearRules(year, taxDocs, deductionDocs),
  ]))

  return {
    availableYears,
    rulesByYear,
    source: 'payload',
  }
}

function buildYearRules(year: number, taxDocs: CmsTaxRateDoc[], deductionDocs: CmsSpecialDeductionDoc[]): IncomeTaxYearRules {
  const taxRates = requiredTaxRateRules.flatMap((requiredRule) => {
    const document = findEffectiveDocument(
      taxDocs.filter((doc) => doc.ruleYear === year && doc.incomeType === requiredRule.incomeType && doc.taxpayerIdentity === requiredRule.taxpayerIdentity),
      year,
    )
    return document ? [adaptTaxRateRule(document, requiredRule)] : []
  })
  const salaryRule = taxRates.find((rule) => rule.incomeType === 'salary' && rule.taxpayerIdentity === 'resident' && rule.rateMode === 'table')
  const taxBrackets = salaryRule && salaryRule.brackets.length > 0 ? salaryRule.brackets : fallbackTaxBrackets
  const taxRateAvailable = Boolean(salaryRule && salaryRule.brackets.length > 0)
  const taxRateWarnings = requiredTaxRateRules
    .filter((requiredRule) => !taxRates.some((rule) => rule.incomeType === requiredRule.incomeType && rule.taxpayerIdentity === requiredRule.taxpayerIdentity))
    .map((requiredRule) => `${year} 年${requiredRule.label}税率规则尚未在 CMS 中发布，税率表将显示内置参考值。`)

  const cmsDeductions = deductionDocs.filter((doc) => doc.ruleYear === year)
  const requiredDeductionTypes = Object.values(deductionTypeByGroupKey)
  const specialDeductionAvailable = requiredDeductionTypes.every((type) => cmsDeductions.some((doc) => doc.deductionType === type && isEffectiveInYear(doc, year)))
  const groups = fallbackDeductionGroups.map((fallbackGroup) => {
    const deductionType = deductionTypeByGroupKey[fallbackGroup.key]
    if (!deductionType) return fallbackGroup

    const cmsRule = findEffectiveDocument(cmsDeductions.filter((doc) => doc.deductionType === deductionType), year)
    return cmsRule ? adaptDeductionGroup(fallbackGroup, cmsRule, deductionType) : fallbackGroup
  })
  const checkedAt = [salaryRule?.checkedAt, ...cmsDeductions.map((doc) => findEffectiveDocument([doc], year)?.source?.checkedAt)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)

  const missingReasons = [
    !taxRateAvailable ? `${year} 年居民工资薪金税率规则尚未在 CMS 中发布。` : '',
    !specialDeductionAvailable ? `${year} 年专项附加扣除规则尚未完整发布。` : '',
  ].filter(Boolean)

  return {
    year,
    taxBrackets,
    taxRates,
    specialDeductionGroups: groups,
    specialDeductionItems: createSpecialDeductionItems(groups),
    taxRateAvailable,
    taxRateWarnings,
    specialDeductionAvailable,
    source: missingReasons.length > 0 || taxRateWarnings.length > 0 ? 'fallback' : 'payload',
    checkedAt,
    missingReasons,
  }
}

function adaptTaxRateRule(document: CmsTaxRateDoc, requiredRule: { incomeType: IncomeTaxIncomeType; taxpayerIdentity: IncomeTaxpayerIdentity }): IncomeTaxRateRule {
  const rateMode = document.rateMode === 'flat' ? 'flat' : 'table'
  return {
    incomeType: requiredRule.incomeType,
    taxpayerIdentity: requiredRule.taxpayerIdentity,
    rateMode,
    brackets: rateMode === 'table' ? normalizeTaxBrackets(document.tableRows) : [],
    flatRate: rateMode === 'flat' && typeof document.flatRate === 'number' ? normalizeRate(document.flatRate) : undefined,
    checkedAt: document.source?.checkedAt || undefined,
  }
}

function adaptDeductionGroup(fallbackGroup: SpecialDeductionGroup, rule: CmsSpecialDeductionDoc, deductionType: string): SpecialDeductionGroup {
  const options = (rule.allocationOptions || [])
    .filter((option) => typeof option.label === 'string' && typeof option.monthlyAmount === 'number')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((option, index) => ({
      id: `${deductionType}-${index + 1}`,
      label: option.label as string,
      amount: option.monthlyAmount as number,
    }))

  if (options.length === 0 && typeof rule.monthlyAmount === 'number' && rule.monthlyAmount > 0) {
    options.push({ id: `${deductionType}-default`, label: '按当前规则默认标准扣除', amount: rule.monthlyAmount })
  }

  return {
    ...fallbackGroup,
    note: rule.conditions?.summary || fallbackGroup.note,
    options: options.length > 0 ? options : fallbackGroup.options,
  }
}

function normalizeTaxBrackets(rows: CmsTaxRateRow[] | null | undefined): TaxBracket[] {
  return [...(rows || [])]
    .filter((row) => typeof row.rate === 'number' && Number.isFinite(row.rate))
    .sort((a, b) => (a.sortOrder ?? a.lowerBound ?? 0) - (b.sortOrder ?? b.lowerBound ?? 0))
    .map((row) => ({
      ceiling: typeof row.upperBound === 'number' ? row.upperBound : Infinity,
      rate: normalizeRate(row.rate as number),
      quick: typeof row.quickDeduction === 'number' ? row.quickDeduction : 0,
      rangeLabel: row.rangeLabel || undefined,
    }))
}

function normalizeRate(value: number) {
  return value > 1 ? value / 100 : value
}

function findEffectiveDocument<T extends { ruleYear?: number | null; effectiveFrom?: string | null; effectiveTo?: string | null }>(documents: T[], year: number) {
  return documents
    .filter((document) => isEffectiveInYear(document, year))
    .sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0]
}

function isEffectiveInYear(document: { ruleYear?: number | null; effectiveFrom?: string | null; effectiveTo?: string | null }, year: number) {
  if (document.ruleYear !== year) return false
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const effectiveFrom = document.effectiveFrom || start
  return effectiveFrom <= end && (!document.effectiveTo || document.effectiveTo >= start)
}

function isYear(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 2000 && value <= 2100
}

function createUnavailableDataset(fallbackReason: string): IncomeTaxRuleDataset {
  const fallbackYear: IncomeTaxYearRules = {
    year: currentYear,
    taxBrackets: fallbackTaxBrackets,
    taxRates: [],
    specialDeductionGroups: fallbackDeductionGroups,
    specialDeductionItems: createSpecialDeductionItems(fallbackDeductionGroups),
    taxRateAvailable: false,
    taxRateWarnings: ['当前无法读取 CMS 非工资所得税率规则，税率表将显示内置参考值。'],
    specialDeductionAvailable: false,
    source: 'unavailable',
    missingReasons: ['当前无法读取 CMS 税率和专项附加扣除规则，已停止估算。'],
  }

  return {
    availableYears: [currentYear],
    rulesByYear: { [currentYear]: fallbackYear },
    source: 'unavailable',
    fallbackReason,
  }
}
