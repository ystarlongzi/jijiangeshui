import assert from 'node:assert/strict'
import test from 'node:test'

import { cityRules, type CityRule } from './tax-rules'
import { getEffectiveHousingRate, getValidatedHousingRateOptions, validateCityRuleInputs, validateHousingRateInputs } from './city-rule-validation'

test('城市规则输入校验：默认基数和公积金比例均有效', () => {
  const validation = validateCityRuleInputs(cityRules.beijing, {
    socialBase: 20000,
    housingBase: 20000,
    employeeHousingRate: 12,
    employerHousingRate: 12,
  })

  assert.equal(validation.socialBase.valid, true)
  assert.equal(validation.housingBase.valid, true)
  assert.equal(validation.employeeHousingRate.valid, true)
  assert.equal(validation.employerHousingRate.valid, true)
  assert.deepEqual(validation.options, [3, 5, 7, 8, 10, 12])
})

test('城市规则输入校验：基数越界和未配置比例会被标记', () => {
  const validation = validateCityRuleInputs(cityRules.beijing, {
    socialBase: cityRules.beijing.socialMin - 1,
    housingBase: cityRules.beijing.housingMax + 1,
    employeeHousingRate: 4,
    employerHousingRate: 13,
  })

  assert.equal(validation.socialBase.valid, false)
  assert.equal(validation.housingBase.valid, false)
  assert.equal(validation.employeeHousingRate.valid, false)
  assert.equal(validation.employerHousingRate.valid, false)
})

test('城市规则输入校验：空比例规则不会被当成可用配置', () => {
  const brokenRule: CityRule = { ...cityRules.beijing, housingRateOptions: [] }
  const validation = validateHousingRateInputs(brokenRule, 12, 12)

  assert.deepEqual(getValidatedHousingRateOptions(brokenRule), [])
  assert.equal(validation.employeeHousingRate.valid, false)
  assert.equal(validation.employerHousingRate.valid, false)
})

test('城市规则输入校验：城市切换时无效比例回退到当前规则上限', () => {
  assert.equal(getEffectiveHousingRate(12, [5, 7]), 7)
  assert.equal(getEffectiveHousingRate(7, [5, 7]), 7)
  assert.equal(getEffectiveHousingRate(12, []), 12)
})
