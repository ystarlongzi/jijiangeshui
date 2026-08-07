import type { CityRule, ContributionSideRule } from './tax-rules'
import { getContributionBaseRule, taxBrackets, type TaxBracket } from './tax-rules'

export type InsuranceItem = {
  name: string
  employee: number
  employer: number
  employeeFormula: string
  employerFormula: string
  housing?: boolean
  subtotal: number
}

export type MonthlyCalculation = {
  employeeInsurance: number
  employerInsurance: number
  monthsWorked: number
  cumulativeSalary: number
  cumulativeInsurance: number
  taxable: number
  bracket: TaxBracket
  cumulativeTax: number
  currentTax: number
  takeHome: number
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const getBracket = (taxable: number, brackets: TaxBracket[] = taxBrackets) => brackets.find((bracket) => taxable <= bracket.ceiling) || brackets[brackets.length - 1] || taxBrackets[taxBrackets.length - 1]

export function calculateInsurance(rule: CityRule, socialBase: number, housingBase: number, employeeHousingRate: number, employerHousingRate: number): InsuranceItem[] {
  return rule.contributionItems.map((item) => {
    const sourceBase = item.baseType === 'housingFund' ? housingBase : socialBase
    const baseRule = getContributionBaseRule(rule, item.baseType)
    const base = clamp(sourceBase, baseRule.min, baseRule.max)
    const employeeRule = item.housing ? { method: 'rate' as const, rate: employeeHousingRate } : item.employee
    const employerRule = item.housing ? { method: 'rate' as const, rate: employerHousingRate } : item.employer
    const employee = calculateContributionSide(employeeRule, base)
    const employer = calculateContributionSide(employerRule, base)

    return {
      name: item.name,
      employee,
      employer,
      employeeFormula: formatContributionFormula(employeeRule, base),
      employerFormula: formatContributionFormula(employerRule, base),
      housing: item.housing,
      subtotal: employee + employer,
    }
  })
}

function calculateContributionSide(rule: ContributionSideRule, base: number) {
  if (rule.method === 'none') return 0
  if (rule.method === 'fixed') return rule.fixedAmount || 0
  if (rule.method === 'rate') return base * ((rule.rate || 0) / 100)
  return base * ((rule.rate || 0) / 100) + (rule.fixedAmount || 0)
}

function formatContributionFormula(rule: ContributionSideRule, base: number) {
  if (rule.method === 'none') return '-'
  if (rule.method === 'fixed') return `¥${rule.fixedAmount || 0}`
  if (rule.method === 'rate') return `${Math.round(base)} × ${rule.rate || 0}%`
  return `${Math.round(base)} × ${rule.rate || 0}% + ¥${rule.fixedAmount || 0}`
}

export function calculateMonth(salary: number, month: number, startMonth: number, deduction: number, insuranceItems: InsuranceItem[], options: MonthlyCalculationOptions = {}): MonthlyCalculation {
  return calculateMonthFromSeries(Array.from({ length: 12 }, () => salary), month, startMonth, deduction, insuranceItems, options)
}

export type MonthlyCalculationOptions = {
  taxBrackets?: TaxBracket[]
  /** 每个自然月实际套用的社保、公积金明细；不传时沿用同一份明细。 */
  insuranceByMonth?: InsuranceItem[][]
}

export function calculateMonthFromSeries(
  salaries: number[],
  month: number,
  startMonth: number,
  deduction: number,
  insuranceItems: InsuranceItem[],
  options: MonthlyCalculationOptions = {},
): MonthlyCalculation {
  const monthsWorked = Math.max(0, month - startMonth + 1)
  const brackets = options.taxBrackets && options.taxBrackets.length > 0 ? options.taxBrackets : taxBrackets
  if (monthsWorked === 0) {
    return {
      employeeInsurance: 0,
      employerInsurance: 0,
      monthsWorked,
      cumulativeSalary: 0,
      cumulativeInsurance: 0,
      taxable: 0,
      bracket: brackets[0] || taxBrackets[0],
      cumulativeTax: 0,
      currentTax: 0,
      takeHome: 0,
    }
  }

  // 逐月模式下，规则版本、工资基数或工资金额都可能变化；当前月到手必须使用当前月的个人缴费额。
  const insuranceForCurrentMonth = options.insuranceByMonth?.[month - 1] || insuranceItems
  const employeeInsurance = insuranceForCurrentMonth.reduce((sum, item) => sum + item.employee, 0)
  const employerInsurance = insuranceForCurrentMonth.reduce((sum, item) => sum + item.employer, 0)
  const currentSalary = salaries[month - 1] || 0
  const cumulativeSalary = salaries.slice(startMonth - 1, month).reduce((sum, item) => sum + item, 0)
  const cumulativeInsurance = Array.from({ length: monthsWorked }, (_, index) => {
    const monthIndex = startMonth - 1 + index
    const monthInsurance = options.insuranceByMonth?.[monthIndex] || insuranceItems
    return monthInsurance.reduce((sum, item) => sum + item.employee, 0)
  }).reduce((sum, item) => sum + item, 0)
  const cumulativeDeductions = deduction * monthsWorked
  const taxable = Math.max(0, cumulativeSalary - cumulativeInsurance - cumulativeDeductions - 5000 * monthsWorked)
  const bracket = getBracket(taxable, brackets)
  const cumulativeTax = Math.max(0, taxable * bracket.rate - bracket.quick)
  const previous = month > startMonth
    ? calculateMonthFromSeries(salaries, month - 1, startMonth, deduction, insuranceItems, options).cumulativeTax
    : 0
  const currentTax = Math.max(0, cumulativeTax - previous)

  return {
    employeeInsurance,
    employerInsurance,
    monthsWorked,
    cumulativeSalary,
    cumulativeInsurance,
    taxable,
    bracket,
    cumulativeTax,
    currentTax,
    takeHome: currentSalary - employeeInsurance - currentTax,
  }
}
