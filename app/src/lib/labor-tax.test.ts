import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateLaborTax } from './labor-tax'

test('劳务报酬：不超过 4000 元时先扣除 800 元费用', () => {
  const result = calculateLaborTax(3000)

  assert.equal(result.deduction, 800)
  assert.equal(result.taxable, 2200)
  assert.equal(Math.round(result.bracket.rate * 100), 20)
  assert.equal(result.tax, 440)
  assert.equal(result.takeHome, 2560)
})

test('劳务报酬：超过 4000 元时按收入 80% 计算应纳税所得额', () => {
  const result = calculateLaborTax(10000)

  assert.equal(result.deduction, 2000)
  assert.equal(result.taxable, 8000)
  assert.equal(result.tax, 1600)
  assert.equal(result.takeHome, 8400)
})

test('劳务报酬：应纳税所得额超过 20000 元时进入 30% 预扣率档', () => {
  const result = calculateLaborTax(30000)

  assert.equal(result.taxable, 24000)
  assert.equal(Math.round(result.bracket.rate * 100), 30)
  assert.equal(result.bracket.quick, 2000)
  assert.equal(result.tax, 5200)
  assert.equal(result.takeHome, 24800)
})
