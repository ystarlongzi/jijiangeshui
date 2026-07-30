import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateAuthorTax } from './author-tax'

test('稿酬所得：不超过 4000 元时扣除 800 元费用后再减按 70%', () => {
  const result = calculateAuthorTax(3000)

  assert.equal(result.expenseDeduction, 800)
  assert.equal(result.incomeAfterExpense, 2200)
  assert.equal(result.taxable, 1540)
  assert.equal(result.tax, 308)
  assert.equal(result.takeHome, 2692)
})

test('稿酬所得：超过 4000 元时先扣除 20% 费用再减按 70%', () => {
  const result = calculateAuthorTax(10000)

  assert.equal(result.expenseDeduction, 2000)
  assert.equal(result.incomeAfterExpense, 8000)
  assert.equal(result.taxable, 5600)
  assert.equal(result.tax, 1120)
  assert.equal(result.takeHome, 8880)
})
