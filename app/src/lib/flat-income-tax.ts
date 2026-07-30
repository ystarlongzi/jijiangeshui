import { roundMoney } from './tax-calculator'

export function calculateFlatIncomeTax(income: number, rate = 0.2) {
  const tax = roundMoney(Math.max(0, income) * rate)

  return {
    income: roundMoney(income),
    rate,
    tax,
    takeHome: roundMoney(income - tax),
  }
}
