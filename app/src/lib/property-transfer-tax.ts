import { roundMoney } from './tax-calculator'

export type PropertyTransferTaxInput = {
  income: number
  originalValue?: number
  reasonableFees?: number
  taxRate?: number
}

export function calculatePropertyTransferTax({ income, originalValue = 0, reasonableFees = 0, taxRate = 0.2 }: PropertyTransferTaxInput) {
  const safeIncome = Math.max(0, income)
  const cost = Math.max(0, originalValue)
  const fees = Math.max(0, reasonableFees)
  const taxable = Math.max(0, safeIncome - cost - fees)
  const safeTaxRate = Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 1 ? taxRate : 0.2
  const tax = roundMoney(taxable * safeTaxRate)

  return {
    income: roundMoney(safeIncome),
    originalValue: roundMoney(originalValue),
    reasonableFees: roundMoney(reasonableFees),
    taxable: roundMoney(taxable),
    rate: safeTaxRate,
    tax,
    takeHome: roundMoney(safeIncome - tax),
  }
}
