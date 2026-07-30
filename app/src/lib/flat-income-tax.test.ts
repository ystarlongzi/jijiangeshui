import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateFlatIncomeTax } from './flat-income-tax'

test('比例所得：默认按 20% 计算个人所得税', () => {
  const result = calculateFlatIncomeTax(10000)

  assert.equal(result.tax, 2000)
  assert.equal(result.takeHome, 8000)
})

test('比例所得：收入为 0 时不产生税额', () => {
  const result = calculateFlatIncomeTax(0)

  assert.equal(result.tax, 0)
  assert.equal(result.takeHome, 0)
})

test('比例所得：负数收入按 0 处理', () => {
  const result = calculateFlatIncomeTax(-1000)

  assert.equal(result.income, 0)
  assert.equal(result.tax, 0)
  assert.equal(result.takeHome, 0)
})
