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

test('劳务报酬：应纳税所得额超过 50000 元时进入 40% 预扣率档', () => {
  const result = calculateLaborTax(70000)

  assert.equal(result.taxable, 56000)
  assert.equal(Math.round(result.bracket.rate * 100), 40)
  assert.equal(result.bracket.quick, 7000)
  assert.equal(result.tax, 15400)
})

test('劳务报酬：负数收入按 0 处理', () => {
  const result = calculateLaborTax(-1000)

  assert.equal(result.income, 0)
  assert.equal(result.tax, 0)
  assert.equal(result.takeHome, 0)
})

test('劳务报酬：传入 CMS 档位后按 CMS 税率和速算扣除数计算', () => {
  const result = calculateLaborTax(10000, [{ ceiling: Infinity, rate: 0.1, quick: 100 }])

  assert.equal(result.bracket.rate, 0.1)
  assert.equal(result.bracket.quick, 100)
  assert.equal(result.tax, 700)
})
