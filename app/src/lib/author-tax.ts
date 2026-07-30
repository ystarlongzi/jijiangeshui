import { roundMoney } from './tax-calculator'

export function calculateAuthorTax(income: number) {
  const safeIncome = Math.max(0, income)
  const expenseDeduction = safeIncome <= 4000 ? Math.min(800, safeIncome) : safeIncome * 0.2
  const incomeAfterExpense = Math.max(0, safeIncome - expenseDeduction)
  const taxable = incomeAfterExpense * 0.7
  const rate = 0.2
  const tax = roundMoney(taxable * rate)

  return {
    income: roundMoney(safeIncome),
    expenseDeduction: roundMoney(expenseDeduction),
    incomeAfterExpense: roundMoney(incomeAfterExpense),
    taxable: roundMoney(taxable),
    rate,
    tax,
    takeHome: roundMoney(safeIncome - tax),
  }
}
