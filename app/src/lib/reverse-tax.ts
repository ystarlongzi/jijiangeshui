import { calculateInsurance, calculateMonth, clamp, roundMoney } from './tax-calculator'
import type { CityRule, TaxBracket } from './tax-rules'

type ReverseTaxInput = {
  targetTakeHome: number
  rule: CityRule
  month: number
  startMonth: number
  deduction: number
  employeeHousingRate: number
  employerHousingRate: number
  taxBrackets?: TaxBracket[]
}

export function calculateReverseTax({ targetTakeHome, rule, month, startMonth, deduction, employeeHousingRate, employerHousingRate, taxBrackets }: ReverseTaxInput) {
  const evaluate = (salary: number) => {
    const socialBase = clamp(salary, rule.socialMin, rule.socialMax)
    const housingBase = clamp(salary, rule.housingMin, rule.housingMax)
    const insurance = calculateInsurance(rule, socialBase, housingBase, employeeHousingRate, employerHousingRate)
    const result = calculateMonth(salary, month, startMonth, deduction, insurance, { taxBrackets })
    return { salary, socialBase, housingBase, insurance, result }
  }

  let low = 0
  let high = Math.max(targetTakeHome * 2, rule.socialMax * 1.5, 20000)
  while (evaluate(high).result.takeHome < targetTakeHome && high < 99999999) high *= 2

  for (let index = 0; index < 48; index += 1) {
    const mid = (low + high) / 2
    if (evaluate(mid).result.takeHome >= targetTakeHome) high = mid
    else low = mid
  }

  const exact = evaluate(high)
  return {
    ...exact,
    salary: roundMoney(exact.salary),
    gap: roundMoney(exact.result.takeHome - targetTakeHome),
  }
}
