import type { SpecialDeductionGroup, SpecialDeductionItem } from './special-deductions'
import type { TaxBracket } from './tax-rules'

export type IncomeTaxRuleSource = 'payload' | 'fallback' | 'unavailable'

export type IncomeTaxIncomeType = 'salary' | 'labor' | 'author' | 'license' | 'business' | 'rental' | 'transfer' | 'dividend' | 'accidental'
export type IncomeTaxpayerIdentity = 'resident' | 'nonResident' | 'notApplicable'

export type IncomeTaxRateRule = {
  incomeType: IncomeTaxIncomeType
  taxpayerIdentity: IncomeTaxpayerIdentity
  rateMode: 'table' | 'flat'
  brackets: TaxBracket[]
  flatRate?: number
  checkedAt?: string
}

export type IncomeTaxYearRules = {
  year: number
  taxBrackets: TaxBracket[]
  taxRates: IncomeTaxRateRule[]
  specialDeductionGroups: SpecialDeductionGroup[]
  specialDeductionItems: SpecialDeductionItem[]
  taxRateAvailable: boolean
  taxRateWarnings: string[]
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
