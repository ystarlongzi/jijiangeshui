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

test('经营所得：高额应纳税所得额进入 35% 档', () => {
  const result = calculateBusinessTax({ revenue: 600000 })

  assert.equal(result.taxable, 600000)
  assert.equal(result.bracket.rate, 0.35)
  assert.equal(result.bracket.quick, 65500)
  assert.equal(result.tax, 144500)
})

test('经营所得：负数收入按 0 处理', () => {
  const result = calculateBusinessTax({ revenue: -1000, costsAndExpenses: 100 })

  assert.equal(result.revenue, 0)
  assert.equal(result.taxable, 0)
  assert.equal(result.tax, 0)
  assert.equal(result.afterTax, 0)
})

test('经营所得：传入 CMS 档位后按 CMS 税率表计算', () => {
  const result = calculateBusinessTax({ revenue: 100000 }, [{ ceiling: Infinity, rate: 0.08, quick: 500 }])

  assert.equal(result.bracket.rate, 0.08)
  assert.equal(result.bracket.quick, 500)
  assert.equal(result.tax, 7500)
})
