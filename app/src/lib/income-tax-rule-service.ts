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
import type { IncomeTaxRuleDataset, IncomeTaxYearRules } from './income-tax-rule-types'

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
  incomeType?: string | null
  taxpayerIdentity?: string | null
  rateMode?: string | null
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
  const salaryRule = findEffectiveDocument(
    taxDocs.filter((doc) => doc.ruleYear === year && doc.incomeType === 'salary' && doc.taxpayerIdentity === 'resident' && doc.rateMode === 'table'),
    year,
  )
  const taxBrackets = salaryRule ? normalizeTaxBrackets(salaryRule.tableRows) : fallbackTaxBrackets
  const taxRateAvailable = Boolean(salaryRule && taxBrackets.length > 0)

  const cmsDeductions = deductionDocs.filter((doc) => doc.ruleYear === year)
  const requiredDeductionTypes = Object.values(deductionTypeByGroupKey)
  const specialDeductionAvailable = requiredDeductionTypes.every((type) => cmsDeductions.some((doc) => doc.deductionType === type && isEffectiveInYear(doc, year)))
  const groups = fallbackDeductionGroups.map((fallbackGroup) => {
    const deductionType = deductionTypeByGroupKey[fallbackGroup.key]
    if (!deductionType) return fallbackGroup

    const cmsRule = findEffectiveDocument(cmsDeductions.filter((doc) => doc.deductionType === deductionType), year)
    return cmsRule ? adaptDeductionGroup(fallbackGroup, cmsRule, deductionType) : fallbackGroup
  })
  const checkedAt = [salaryRule?.source?.checkedAt, ...cmsDeductions.map((doc) => findEffectiveDocument([doc], year)?.source?.checkedAt)]
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
    specialDeductionGroups: groups,
    specialDeductionItems: createSpecialDeductionItems(groups),
    taxRateAvailable,
    specialDeductionAvailable,
    source: missingReasons.length > 0 ? 'fallback' : 'payload',
    checkedAt,
    missingReasons,
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
    specialDeductionGroups: fallbackDeductionGroups,
    specialDeductionItems: createSpecialDeductionItems(fallbackDeductionGroups),
    taxRateAvailable: false,
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
