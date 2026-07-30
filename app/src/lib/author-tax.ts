import { roundMoney } from './tax-calculator'

export function calculateAuthorTax(income: number) {
  const expenseDeduction = income <= 4000 ? Math.min(800, income) : income * 0.2
  const incomeAfterExpense = Math.max(0, income - expenseDeduction)
  const taxable = incomeAfterExpense * 0.7
  const rate = 0.2
  const tax = roundMoney(taxable * rate)

  return {
    income: roundMoney(income),
    expenseDeduction: roundMoney(expenseDeduction),
    incomeAfterExpense: roundMoney(incomeAfterExpense),
    taxable: roundMoney(taxable),
    rate,
    tax,
    takeHome: roundMoney(income - tax),
  }
}
