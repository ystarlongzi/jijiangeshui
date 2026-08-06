import { roundMoney } from './tax-calculator'
import type { TaxBracket } from './tax-rules'

export type LaborBracket = TaxBracket

export const laborTaxBrackets: LaborBracket[] = [
  { ceiling: 20000, rate: 0.2, quick: 0 },
  { ceiling: 50000, rate: 0.3, quick: 2000 },
  { ceiling: Infinity, rate: 0.4, quick: 7000 },
]

export function calculateLaborTax(income: number, brackets: LaborBracket[] = laborTaxBrackets) {
  const safeIncome = Math.max(0, income)
  const deduction = safeIncome <= 4000 ? Math.min(800, safeIncome) : safeIncome * 0.2
  const taxable = Math.max(0, safeIncome - deduction)
  // CMS 表格为空时回到内置表，避免页面因数据缺失而中断计算。
  const activeBrackets = brackets.length > 0 ? brackets : laborTaxBrackets
  const bracket = activeBrackets.find((item) => taxable <= item.ceiling) || activeBrackets[activeBrackets.length - 1]
  const tax = roundMoney(Math.max(0, taxable * bracket.rate - bracket.quick))

  return {
    income: roundMoney(safeIncome),
    deduction: roundMoney(deduction),
    taxable: roundMoney(taxable),
    bracket,
    tax,
    takeHome: roundMoney(safeIncome - tax),
  }
}
