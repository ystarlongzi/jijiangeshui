import { roundMoney } from './tax-calculator'

export function calculateLicenseTax(income: number) {
  const safeIncome = Math.max(0, income)
  const deduction = safeIncome <= 4000 ? Math.min(800, safeIncome) : safeIncome * 0.2
  const taxable = Math.max(0, safeIncome - deduction)
  const rate = 0.2
  const tax = roundMoney(taxable * rate)

  return {
    income: roundMoney(safeIncome),
    deduction: roundMoney(deduction),
    taxable: roundMoney(taxable),
    rate,
    tax,
    takeHome: roundMoney(safeIncome - tax),
  }
}
