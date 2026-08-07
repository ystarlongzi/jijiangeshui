import { roundMoney } from './tax-calculator'

export function calculateFlatIncomeTax(income: number, rate = 0.2) {
  const safeIncome = Math.max(0, income)
  const safeRate = Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.2
  const tax = roundMoney(safeIncome * safeRate)

  return {
    income: roundMoney(safeIncome),
    rate: safeRate,
    tax,
    takeHome: roundMoney(safeIncome - tax),
  }
}
