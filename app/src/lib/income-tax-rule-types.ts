import type { SpecialDeductionGroup, SpecialDeductionItem } from './special-deductions'
import type { TaxBracket } from './tax-rules'

export type IncomeTaxRuleSource = 'payload' | 'fallback' | 'unavailable'

export type IncomeTaxYearRules = {
  year: number
  taxBrackets: TaxBracket[]
  specialDeductionGroups: SpecialDeductionGroup[]
  specialDeductionItems: SpecialDeductionItem[]
  taxRateAvailable: boolean
  specialDeductionAvailable: boolean
  source: IncomeTaxRuleSource
  checkedAt?: string
  missingReasons: string[]
}

export type IncomeTaxRuleDataset = {
  availableYears: number[]
  rulesByYear: Record<string, IncomeTaxYearRules>
  source: IncomeTaxRuleSource
  fallbackReason?: string
}

