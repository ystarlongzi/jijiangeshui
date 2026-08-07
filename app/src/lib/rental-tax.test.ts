import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateRentalTax } from './rental-tax'

test('财产租赁：住房出租默认按 10% 优惠税率', () => {
  const result = calculateRentalTax({ income: 5000 })

  assert.equal(result.incomeAfterCosts, 5000)
  assert.equal(result.statutoryDeduction, 1000)
  assert.equal(result.taxable, 4000)
  assert.equal(result.rate, 0.1)
  assert.equal(result.tax, 400)
  assert.equal(result.takeHome, 4600)
})

test('财产租赁：每次收入不超过 4000 元时扣除 800 元费用', () => {
  const result = calculateRentalTax({ income: 3000, mode: 'general' })

  assert.equal(result.statutoryDeduction, 800)
  assert.equal(result.taxable, 2200)
  assert.equal(result.tax, 440)
})

test('财产租赁：修缮费每次最多扣除 800 元', () => {
  const result = calculateRentalTax({ income: 4600, taxesAndFees: 200, repairExpense: 1200, mode: 'general' })

  assert.equal(result.repairDeduction, 800)
  assert.equal(result.incomeAfterCosts, 3600)
  assert.equal(result.statutoryDeduction, 800)
  assert.equal(result.taxable, 2800)
  assert.equal(result.tax, 560)
})

test('财产租赁：负数收入按 0 处理', () => {
  const result = calculateRentalTax({ income: -1000, taxesAndFees: 100, repairExpense: 500 })

  assert.equal(result.income, 0)
  assert.equal(result.incomeAfterCosts, 0)
  assert.equal(result.tax, 0)
  assert.equal(result.takeHome, 0)
})

test('财产租赁：其他财产使用 CMS 比例税率，住房优惠税率保持独立口径', () => {
  const general = calculateRentalTax({ income: 5000, mode: 'general', generalRate: 0.08 })
  const housing = calculateRentalTax({ income: 5000, mode: 'housing', generalRate: 0.08 })

  assert.equal(general.rate, 0.08)
  assert.equal(general.tax, 320)
  assert.equal(housing.rate, 0.1)
  assert.equal(housing.tax, 400)
})
