import { getContributionBaseRule, getHousingRateOptions, type CityRule } from './tax-rules'

export type CityRuleInputValues = {
  socialBase: number
  housingBase: number
  employeeHousingRate: number
  employerHousingRate: number
}

export type HousingRateInputValidation = {
  options: number[]
  employeeHousingRate: { valid: boolean }
  employerHousingRate: { valid: boolean }
}

export type CityRuleInputValidation = HousingRateInputValidation & {
  socialBase: { valid: boolean; min: number; max: number }
  housingBase: { valid: boolean; min: number; max: number }
}

export function getValidatedHousingRateOptions(rule: CityRule) {
  const options = getHousingRateOptions(rule)
  if (!Array.isArray(options)) return []

  return [...new Set(options.filter((rate) => Number.isFinite(rate)))].sort((a, b) => a - b)
}

export function validateHousingRateInputs(rule: CityRule, employeeHousingRate: number, employerHousingRate: number): HousingRateInputValidation {
  const options = getValidatedHousingRateOptions(rule)

  return {
    options,
    employeeHousingRate: { valid: options.includes(employeeHousingRate) },
    employerHousingRate: { valid: options.includes(employerHousingRate) },
  }
}

export function validateCityRuleInputs(rule: CityRule, values: CityRuleInputValues): CityRuleInputValidation {
  const socialRule = getContributionBaseRule(rule, 'social')
  const housingRule = getContributionBaseRule(rule, 'housingFund')
  const housingRates = validateHousingRateInputs(rule, values.employeeHousingRate, values.employerHousingRate)

  return {
    ...housingRates,
    socialBase: {
      valid: isWithinRange(values.socialBase, socialRule.min, socialRule.max),
      min: socialRule.min,
      max: socialRule.max,
    },
    housingBase: {
      valid: isWithinRange(values.housingBase, housingRule.min, housingRule.max),
      min: housingRule.min,
      max: housingRule.max,
    },
  }
}

function isWithinRange(value: number, min: number, max: number) {
  return Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && min <= max && value >= min && value <= max
}
