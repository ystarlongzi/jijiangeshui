import { roundMoney } from './tax-calculator'

export type RentalTaxRateMode = 'housing' | 'general'

export type RentalTaxInput = {
  income: number
  taxesAndFees?: number
  subleaseRent?: number
  repairExpense?: number
  mode?: RentalTaxRateMode
}

export function calculateRentalTax({
  income,
  taxesAndFees = 0,
  subleaseRent = 0,
  repairExpense = 0,
  mode = 'housing',
}: RentalTaxInput) {
  const repairDeduction = Math.min(Math.max(0, repairExpense), 800)
  const deductibleCosts = Math.max(0, taxesAndFees) + Math.max(0, subleaseRent) + repairDeduction
  const incomeAfterCosts = Math.max(0, income - deductibleCosts)
  const statutoryDeduction = incomeAfterCosts <= 4000 ? Math.min(800, incomeAfterCosts) : incomeAfterCosts * 0.2
  const taxable = Math.max(0, incomeAfterCosts - statutoryDeduction)
  const rate = mode === 'housing' ? 0.1 : 0.2
  const tax = roundMoney(taxable * rate)

  return {
    income: roundMoney(income),
    taxesAndFees: roundMoney(taxesAndFees),
    subleaseRent: roundMoney(subleaseRent),
    repairExpense: roundMoney(repairExpense),
    repairDeduction: roundMoney(repairDeduction),
    deductibleCosts: roundMoney(deductibleCosts),
    incomeAfterCosts: roundMoney(incomeAfterCosts),
    statutoryDeduction: roundMoney(statutoryDeduction),
    taxable: roundMoney(taxable),
    rate,
    tax,
    takeHome: roundMoney(income - tax),
  }
}
