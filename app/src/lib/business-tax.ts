import { roundMoney } from './tax-calculator'
import type { TaxBracket } from './tax-rules'

export type BusinessBracket = TaxBracket

export const businessTaxBrackets: BusinessBracket[] = [
  { ceiling: 30000, rate: 0.05, quick: 0 },
  { ceiling: 90000, rate: 0.1, quick: 1500 },
  { ceiling: 300000, rate: 0.2, quick: 10500 },
  { ceiling: 500000, rate: 0.3, quick: 40500 },
  { ceiling: Infinity, rate: 0.35, quick: 65500 },
]

export type BusinessTaxInput = {
  revenue: number
  costsAndExpenses?: number
  losses?: number
  otherDeductions?: number
}

export function calculateBusinessTax({ revenue, costsAndExpenses = 0, losses = 0, otherDeductions = 0 }: BusinessTaxInput, brackets: BusinessBracket[] = businessTaxBrackets) {
  const safeRevenue = Math.max(0, revenue)
  const totalDeduction = Math.max(0, costsAndExpenses) + Math.max(0, losses) + Math.max(0, otherDeductions)
  const taxable = Math.max(0, safeRevenue - totalDeduction)
  // CMS 表格为空时回到内置表，避免缺少发布数据时出现不可计算状态。
  const activeBrackets = brackets.length > 0 ? brackets : businessTaxBrackets
  const bracket = activeBrackets.find((item) => taxable <= item.ceiling) || activeBrackets[activeBrackets.length - 1]
  const tax = roundMoney(Math.max(0, taxable * bracket.rate - bracket.quick))

  return {
    revenue: roundMoney(safeRevenue),
    costsAndExpenses: roundMoney(costsAndExpenses),
    losses: roundMoney(losses),
    otherDeductions: roundMoney(otherDeductions),
    totalDeduction: roundMoney(totalDeduction),
    taxable: roundMoney(taxable),
    bracket,
    tax,
    afterTax: roundMoney(safeRevenue - tax),
  }
}
