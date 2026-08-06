import { roundMoney } from './tax-calculator'

export function calculateLicenseTax(income: number, rate = 0.2) {
  const safeIncome = Math.max(0, income)
  const deduction = safeIncome <= 4000 ? Math.min(800, safeIncome) : safeIncome * 0.2
  const taxable = Math.max(0, safeIncome - deduction)
  const safeRate = Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.2
  const tax = roundMoney(taxable * safeRate)

  return {
    income: roundMoney(safeIncome),
    deduction: roundMoney(deduction),
    taxable: roundMoney(taxable),
    rate: safeRate,
    tax,
    takeHome: roundMoney(safeIncome - tax),
  }
}
