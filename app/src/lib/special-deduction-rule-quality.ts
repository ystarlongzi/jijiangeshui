export type SpecialDeductionRuleDoc = {
  id: string | number
  ruleYear?: number | null
  deductionType?: string | null
  monthlyAmount?: number | null
  maxMonthlyAmount?: number | null
  allocationOptions?: Array<{
    label?: string | null
    monthlyAmount?: number | null
    sortOrder?: number | null
  }> | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  ruleStatus?: 'pendingReview' | 'active' | 'archived' | null
  source?: { url?: string | null; checkedAt?: string | null } | null
  warnings?: Array<{ message?: string | null }> | null
}

export const requiredSpecialDeductionRules = [
  { type: 'childEducation', label: '子女教育' },
  { type: 'infantCare', label: '婴幼儿照护' },
  { type: 'continuingEducation', label: '继续教育' },
  { type: 'housingLoanInterest', label: '住房贷款利息' },
  { type: 'housingRent', label: '住房租金' },
  { type: 'elderlyCare', label: '赡养老人' },
] as const

export type SpecialDeductionRuleSummary = {
  ruleYear: number
  required: number
  activeRequired: number
  active: number
  status: { pendingReview: number; active: number; archived: number }
  missing: string[]
  duplicates: string[]
  sourceGaps: string[]
  shapeGaps: string[]
  warningCount: number
  ready: boolean
}

export function summarizeSpecialDeductionRules(docs: SpecialDeductionRuleDoc[], ruleYear: number): SpecialDeductionRuleSummary {
  const yearDocs = docs.filter((doc) => doc.ruleYear === ruleYear)
  const activeDocs = yearDocs.filter((doc) => doc.ruleStatus === 'active')
  const activeByType = new Map<string, SpecialDeductionRuleDoc[]>()
  for (const doc of activeDocs) {
    if (!doc.deductionType || !isEffectiveInYear(doc, ruleYear)) continue
    activeByType.set(doc.deductionType, [...(activeByType.get(doc.deductionType) || []), doc])
  }

  const missing = requiredSpecialDeductionRules
    .filter((required) => !activeByType.has(required.type))
    .map((required) => required.label)
  const duplicates = requiredSpecialDeductionRules
    .filter((required) => (activeByType.get(required.type)?.length || 0) > 1)
    .map((required) => `${required.label}（${activeByType.get(required.type)?.length} 条）`)
  const effectiveDocs = requiredSpecialDeductionRules.flatMap((required) => activeByType.get(required.type) || [])
  const sourceGaps = effectiveDocs
    .filter((doc) => !doc.source?.url || !doc.source?.checkedAt)
    .map((doc) => `${doc.deductionType || '未知'}:${doc.id}`)
  const shapeGaps = effectiveDocs.flatMap((doc) => validateShape(doc).map((issue) => `${doc.deductionType || '未知'}:${issue}`))
  const warningCount = effectiveDocs.reduce((total, doc) => total + (doc.warnings?.length || 0), 0)
  const status = yearDocs.reduce((summary, doc) => {
    const key = doc.ruleStatus || 'pendingReview'
    summary[key] += 1
    return summary
  }, { pendingReview: 0, active: 0, archived: 0 })
  const activeRequired = requiredSpecialDeductionRules.filter((required) => activeByType.has(required.type)).length

  return {
    ruleYear,
    required: requiredSpecialDeductionRules.length,
    activeRequired,
    active: activeDocs.length,
    status,
    missing,
    duplicates,
    sourceGaps,
    shapeGaps,
    warningCount,
    ready: missing.length === 0 && duplicates.length === 0 && sourceGaps.length === 0 && shapeGaps.length === 0 && warningCount === 0,
  }
}

function validateShape(doc: SpecialDeductionRuleDoc) {
  const issues: string[] = []
  const monthlyAmount = doc.monthlyAmount
  const maxMonthlyAmount = doc.maxMonthlyAmount
  if (typeof monthlyAmount !== 'number' || !Number.isFinite(monthlyAmount) || monthlyAmount < 0) issues.push('默认月扣除额无效')
  if (typeof maxMonthlyAmount !== 'number' || !Number.isFinite(maxMonthlyAmount) || maxMonthlyAmount < 0) issues.push('最高月扣除额无效')
  if (typeof monthlyAmount === 'number' && typeof maxMonthlyAmount === 'number' && monthlyAmount > maxMonthlyAmount) issues.push('默认月扣除额超过上限')

  const options = doc.allocationOptions || []
  if (options.length === 0) issues.push('缺少分摊方案')
  for (const [index, option] of options.entries()) {
    if (!option.label?.trim()) issues.push(`方案${index + 1}缺少名称`)
    if (typeof option.monthlyAmount !== 'number' || !Number.isFinite(option.monthlyAmount) || option.monthlyAmount < 0) issues.push(`方案${index + 1}金额无效`)
  }
  return issues
}

function isEffectiveInYear(doc: Pick<SpecialDeductionRuleDoc, 'ruleYear' | 'effectiveFrom' | 'effectiveTo'>, year: number) {
  if (doc.ruleYear !== year) return false
  const effectiveFrom = doc.effectiveFrom || `${year}-01-01`
  return effectiveFrom <= `${year}-12-31` && (!doc.effectiveTo || doc.effectiveTo >= `${year}-01-01`)
}
