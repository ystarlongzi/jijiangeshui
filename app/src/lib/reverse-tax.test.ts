import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateReverseTax } from './reverse-tax'
import { cityRules } from './tax-rules'

const baseInput = {
  targetTakeHome: 15000,
  rule: cityRules.beijing,
  month: 8,
  startMonth: 1,
  deduction: 0,
  employeeHousingRate: 12,
  employerHousingRate: 12,
}

test('税后反推：按目标到手工资逼近所需税前月薪', () => {
  const result = calculateReverseTax(baseInput)

  assert.equal(result.salary, 20788.53)
  assert.equal(result.gap, 0)
  assert.ok(Math.abs(result.result.takeHome - 15000) < 0.01)
  assert.ok(result.socialBase >= cityRules.beijing.socialMin)
  assert.ok(result.socialBase <= cityRules.beijing.socialMax)
  assert.ok(result.housingBase >= cityRules.beijing.housingMin)
  assert.ok(result.housingBase <= cityRules.beijing.housingMax)
})

test('税后反推：专项附加扣除会降低所需税前月薪', () => {
  const withoutDeduction = calculateReverseTax(baseInput)
  const withDeduction = calculateReverseTax({ ...baseInput, deduction: 2000 })

  assert.equal(withDeduction.salary, 20501.79)
  assert.ok(withDeduction.salary < withoutDeduction.salary)
  assert.ok(Math.abs(withDeduction.result.takeHome - 15000) < 0.01)
  assert.ok(withDeduction.result.taxable < withoutDeduction.result.taxable)
})

test('税后反推：城市规则会影响单位缴费成本', () => {
  const beijing = calculateReverseTax(baseInput)
  const shenzhen = calculateReverseTax({ ...baseInput, rule: cityRules.shenzhen })

  assert.equal(shenzhen.salary, beijing.salary)
  assert.ok(shenzhen.result.employerInsurance < beijing.result.employerInsurance)
})
