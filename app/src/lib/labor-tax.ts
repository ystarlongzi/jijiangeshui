import { roundMoney } from './tax-calculator'

type LaborBracket = {
  ceiling: number
  rate: number
  quick: number
}

export const laborTaxBrackets: LaborBracket[] = [
  { ceiling: 20000, rate: 0.2, quick: 0 },
  { ceiling: 50000, rate: 0.3, quick: 2000 },
  { ceiling: Infinity, rate: 0.4, quick: 7000 },
]

export function calculateLaborTax(income: number) {
  const deduction = income <= 4000 ? Math.min(800, income) : income * 0.2
  const taxable = Math.max(0, income - deduction)
  const bracket = laborTaxBrackets.find((item) => taxable <= item.ceiling) || laborTaxBrackets[laborTaxBrackets.length - 1]
  const tax = roundMoney(Math.max(0, taxable * bracket.rate - bracket.quick))

  return {
    income: roundMoney(income),
    deduction: roundMoney(deduction),
    taxable: roundMoney(taxable),
    bracket,
    tax,
    takeHome: roundMoney(income - tax),
  }
}
