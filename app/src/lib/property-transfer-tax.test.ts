import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePropertyTransferTax } from './property-transfer-tax'

test('财产转让：收入减原值和合理费用后按 20% 计税', () => {
  const result = calculatePropertyTransferTax({ income: 100000, originalValue: 60000, reasonableFees: 5000 })

  assert.equal(result.taxable, 35000)
  assert.equal(result.tax, 7000)
  assert.equal(result.takeHome, 93000)
})

test('财产转让：亏损或无增值时应纳税所得额不为负数', () => {
  const result = calculatePropertyTransferTax({ income: 50000, originalValue: 60000, reasonableFees: 3000 })

  assert.equal(result.taxable, 0)
  assert.equal(result.tax, 0)
  assert.equal(result.takeHome, 50000)
})
