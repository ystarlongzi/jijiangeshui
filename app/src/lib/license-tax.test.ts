import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateLicenseTax } from './license-tax'

test('特许权使用费：不超过 4000 元时扣除 800 元费用', () => {
  const result = calculateLicenseTax(3000)

  assert.equal(result.deduction, 800)
  assert.equal(result.taxable, 2200)
  assert.equal(result.tax, 440)
  assert.equal(result.takeHome, 2560)
})

test('特许权使用费：超过 4000 元时扣除 20% 费用并按 20% 预扣', () => {
  const result = calculateLicenseTax(10000)

  assert.equal(result.deduction, 2000)
  assert.equal(result.taxable, 8000)
  assert.equal(result.tax, 1600)
  assert.equal(result.takeHome, 8400)
})

test('特许权使用费：负数收入按 0 处理', () => {
  const result = calculateLicenseTax(-1000)

  assert.equal(result.income, 0)
  assert.equal(result.taxable, 0)
  assert.equal(result.tax, 0)
  assert.equal(result.takeHome, 0)
})
