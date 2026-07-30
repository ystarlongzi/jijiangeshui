import { roundMoney } from './tax-calculator'

type BusinessBracket = {
  ceiling: number
  rate: number
  quick: number
}

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

export function calculateBusinessTax({ revenue, costsAndExpenses = 0, losses = 0, otherDeductions = 0 }: BusinessTaxInput) {
  const totalDeduction = Math.max(0, costsAndExpenses) + Math.max(0, losses) + Math.max(0, otherDeductions)
  const taxable = Math.max(0, revenue - totalDeduction)
  const bracket = businessTaxBrackets.find((item) => taxable <= item.ceiling) || businessTaxBrackets[businessTaxBrackets.length - 1]
  const tax = roundMoney(Math.max(0, taxable * bracket.rate - bracket.quick))

  return {
    revenue: roundMoney(revenue),
    costsAndExpenses: roundMoney(costsAndExpenses),
    losses: roundMoney(losses),
    otherDeductions: roundMoney(otherDeductions),
    totalDeduction: roundMoney(totalDeduction),
    taxable: roundMoney(taxable),
    bracket,
    tax,
    afterTax: roundMoney(revenue - tax),
  }
}
