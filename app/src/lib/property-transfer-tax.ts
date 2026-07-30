import { roundMoney } from './tax-calculator'

export type PropertyTransferTaxInput = {
  income: number
  originalValue?: number
  reasonableFees?: number
}

export function calculatePropertyTransferTax({ income, originalValue = 0, reasonableFees = 0 }: PropertyTransferTaxInput) {
  const cost = Math.max(0, originalValue)
  const fees = Math.max(0, reasonableFees)
  const taxable = Math.max(0, income - cost - fees)
  const tax = roundMoney(taxable * 0.2)

  return {
    income: roundMoney(income),
    originalValue: roundMoney(originalValue),
    reasonableFees: roundMoney(reasonableFees),
    taxable: roundMoney(taxable),
    tax,
    takeHome: roundMoney(income - tax),
  }
}
