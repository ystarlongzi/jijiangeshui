import { taxBrackets } from './tax-rules'
import { getBracket, roundMoney } from './tax-calculator'

export type BonusTaxResult = {
  taxableIncome: number
  bracket: (typeof taxBrackets)[number]
  tax: number
  takeHome: number
}

export type BonusOptimization = {
  suggestedBonus: number
  currentTakeHome: number
  suggestedTakeHome: number
  difference: number
} | null

const getBonusBracket = (bonusPerMonth: number) => {
  const index = taxBrackets.findIndex((item) => bonusPerMonth <= (Number.isFinite(item.ceiling) ? item.ceiling / 12 : Infinity))
  const safeIndex = index === -1 ? taxBrackets.length - 1 : index
  const bracket = taxBrackets[safeIndex]
  return { bracket, quick: bracket.quick / 12, index: safeIndex }
}

export const calculateAnnualTax = (taxableIncome: number) => {
  const taxable = Math.max(0, taxableIncome)
  const bracket = getBracket(taxable)
  return { taxable, bracket, tax: roundMoney(Math.max(0, taxable * bracket.rate - bracket.quick)) }
}

export function calculateBonusTax({ bonus, annualSalary, annualInsurance, annualDeductions }: { bonus: number; annualSalary: number; annualInsurance: number; annualDeductions: number }) {
  const base = calculateAnnualTax(annualSalary - annualInsurance - annualDeductions - 60000)
  const separateRule = getBonusBracket(bonus / 12)
  const separateBracket = separateRule.bracket
  const separateTax = roundMoney(Math.max(0, bonus * separateBracket.rate - separateRule.quick))
  const combined = calculateAnnualTax(base.taxable + bonus)
  const combinedTax = roundMoney(Math.max(0, combined.tax - base.tax))
  const separate: BonusTaxResult = { taxableIncome: base.taxable, bracket: separateBracket, tax: separateTax, takeHome: roundMoney(bonus - separateTax) }
  const combinedResult: BonusTaxResult = { taxableIncome: combined.taxable, bracket: combined.bracket, tax: combinedTax, takeHome: roundMoney(bonus - combinedTax) }
  const separateBracketIndex = separateRule.index
  const previousBracket = separateBracketIndex > 0 ? taxBrackets[separateBracketIndex - 1] : null
  const suggestedBonus = previousBracket && Number.isFinite(previousBracket.ceiling) ? previousBracket.ceiling : null
  const suggestedSeparate = suggestedBonus === null ? null : getBonusBracket(suggestedBonus / 12)
  const suggestedTakeHome = suggestedBonus === null || suggestedSeparate === null ? null : roundMoney(suggestedBonus - Math.max(0, suggestedBonus * suggestedSeparate.bracket.rate - suggestedSeparate.quick))
  const separateOptimization: BonusOptimization = suggestedBonus !== null && suggestedTakeHome !== null && suggestedTakeHome > separate.takeHome
    ? { suggestedBonus, currentTakeHome: separate.takeHome, suggestedTakeHome, difference: roundMoney(suggestedTakeHome - separate.takeHome) }
    : null
  return { base, separate, combined: combinedResult, separateOptimization, better: separate.takeHome >= combinedResult.takeHome ? 'separate' as const : 'combined' as const, difference: roundMoney(Math.abs(separate.takeHome - combinedResult.takeHome)) }
}
