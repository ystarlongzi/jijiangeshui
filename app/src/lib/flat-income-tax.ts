import { roundMoney } from './tax-calculator'

export function calculateFlatIncomeTax(income: number, rate = 0.2) {
  const safeIncome = Math.max(0, income)
  const tax = roundMoney(safeIncome * rate)

  return {
    income: roundMoney(safeIncome),
    rate,
    tax,
    takeHome: roundMoney(safeIncome - tax),
  }
}
