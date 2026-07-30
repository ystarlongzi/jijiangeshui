import { roundMoney } from './tax-calculator'

export function calculateLicenseTax(income: number) {
  const deduction = income <= 4000 ? Math.min(800, income) : income * 0.2
  const taxable = Math.max(0, income - deduction)
  const rate = 0.2
  const tax = roundMoney(taxable * rate)

  return {
    income: roundMoney(income),
    deduction: roundMoney(deduction),
    taxable: roundMoney(taxable),
    rate,
    tax,
    takeHome: roundMoney(income - tax),
  }
}
