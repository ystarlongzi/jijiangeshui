import { roundMoney } from './tax-calculator'

export type RentalTaxRateMode = 'housing' | 'general'

export type RentalTaxInput = {
  income: number
  taxesAndFees?: number
  subleaseRent?: number
  repairExpense?: number
  mode?: RentalTaxRateMode
  /** CMS 的财产租赁比例税率；住房模式仍按单独的 10% 优惠口径计算。 */
  generalRate?: number
}

export function calculateRentalTax({
  income,
  taxesAndFees = 0,
  subleaseRent = 0,
  repairExpense = 0,
  mode = 'housing',
  generalRate = 0.2,
}: RentalTaxInput) {
  const safeIncome = Math.max(0, income)
  const repairDeduction = Math.min(Math.max(0, repairExpense), 800)
  const deductibleCosts = Math.max(0, taxesAndFees) + Math.max(0, subleaseRent) + repairDeduction
  const incomeAfterCosts = Math.max(0, safeIncome - deductibleCosts)
  const statutoryDeduction = incomeAfterCosts <= 4000 ? Math.min(800, incomeAfterCosts) : incomeAfterCosts * 0.2
  const taxable = Math.max(0, incomeAfterCosts - statutoryDeduction)
  const safeGeneralRate = Number.isFinite(generalRate) && generalRate >= 0 && generalRate <= 1 ? generalRate : 0.2
  const rate = mode === 'housing' ? 0.1 : safeGeneralRate
  const tax = roundMoney(taxable * rate)

  return {
    income: roundMoney(safeIncome),
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
    takeHome: roundMoney(safeIncome - tax),
  }
}
