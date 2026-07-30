import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateBusinessTax } from './business-tax'

test('经营所得：按年度应纳税所得额匹配超额累进税率', () => {
  const result = calculateBusinessTax({ revenue: 200000, costsAndExpenses: 80000, losses: 10000 })

  assert.equal(result.taxable, 110000)
  assert.equal(result.bracket.rate, 0.2)
  assert.equal(result.tax, 11500)
})

test('经营所得：扣除额超过收入时不产生应纳税所得额', () => {
  const result = calculateBusinessTax({ revenue: 50000, costsAndExpenses: 70000 })

  assert.equal(result.taxable, 0)
  assert.equal(result.tax, 0)
})
