import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateBonusTax } from './bonus-tax'

test('年终奖默认样例：单独计税比并入综合所得更划算', () => {
  const result = calculateBonusTax({
    bonus: 60000,
    annualSalary: 240000,
    annualInsurance: 54000,
    annualDeductions: 0,
  })

  assert.equal(result.base.taxable, 126000)
  assert.equal(result.separate.tax, 5790)
  assert.equal(result.separate.takeHome, 54210)
  assert.equal(Math.round(result.separate.bracket.rate * 100), 10)
  assert.equal(result.combined.tax, 10200)
  assert.equal(result.combined.takeHome, 49800)
  assert.equal(result.better, 'separate')
  assert.equal(result.difference, 4410)
})

test('年终奖临界点：38000 单独计税会提示 36000 更优', () => {
  const result = calculateBonusTax({
    bonus: 38000,
    annualSalary: 240000,
    annualInsurance: 54000,
    annualDeductions: 0,
  })

  assert.equal(result.separate.tax, 3590)
  assert.equal(result.separate.takeHome, 34410)
  assert.deepEqual(result.separateOptimization, {
    suggestedBonus: 36000,
    currentTakeHome: 34410,
    suggestedTakeHome: 34920,
    difference: 510,
  })
})

test('年终奖未跨临界点时不提示建议金额', () => {
  const result = calculateBonusTax({
    bonus: 32000,
    annualSalary: 10000,
    annualInsurance: 1000,
    annualDeductions: 0,
  })

  assert.equal(result.separate.tax, 960)
  assert.equal(result.separate.takeHome, 31040)
  assert.equal(result.separateOptimization, null)
})
