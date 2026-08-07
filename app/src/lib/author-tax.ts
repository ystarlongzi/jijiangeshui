import { roundMoney } from './tax-calculator'

export function calculateAuthorTax(income: number, rate = 0.2) {
  const safeIncome = Math.max(0, income)
  const expenseDeduction = safeIncome <= 4000 ? Math.min(800, safeIncome) : safeIncome * 0.2
  const incomeAfterExpense = Math.max(0, safeIncome - expenseDeduction)
  const taxable = incomeAfterExpense * 0.7
  const safeRate = Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.2
  const tax = roundMoney(taxable * safeRate)

  return {
    income: roundMoney(safeIncome),
    expenseDeduction: roundMoney(expenseDeduction),
    incomeAfterExpense: roundMoney(incomeAfterExpense),
    taxable: roundMoney(taxable),
    rate: safeRate,
    tax,
    takeHome: roundMoney(safeIncome - tax),
  }
}
