import type { CityRule } from './tax-rules'
import { taxBrackets } from './tax-rules'

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
  bracket: (typeof taxBrackets)[number]
  cumulativeTax: number
  currentTax: number
  takeHome: number
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const getBracket = (taxable: number) => taxBrackets.find((bracket) => taxable <= bracket.ceiling) || taxBrackets[taxBrackets.length - 1]

export function calculateInsurance(rule: CityRule, socialBase: number, housingBase: number, employeeHousingRate: number, employerHousingRate: number): InsuranceItem[] {
  const items = [
    { name: '养老保险', employee: socialBase * (rule.socialEmployee / 100), employer: socialBase * (rule.socialEmployer / 100), employeeFormula: `${Math.round(socialBase)} × ${rule.socialEmployee}%`, employerFormula: `${Math.round(socialBase)} × ${rule.socialEmployer}%` },
    { name: '医疗保险', employee: socialBase * (rule.medicalEmployee / 100), employer: socialBase * (rule.medicalEmployer / 100), employeeFormula: `${Math.round(socialBase)} × ${rule.medicalEmployee}%`, employerFormula: `${Math.round(socialBase)} × ${rule.medicalEmployer}%` },
    { name: '失业保险', employee: socialBase * 0.005, employer: socialBase * 0.005, employeeFormula: `${Math.round(socialBase)} × 0.5%`, employerFormula: `${Math.round(socialBase)} × 0.5%` },
    { name: '工伤保险', employee: 0, employer: socialBase * 0.002, employeeFormula: '-', employerFormula: `${Math.round(socialBase)} × 0.2%` },
    { name: '生育保险', employee: 0, employer: socialBase * 0.008, employeeFormula: '-', employerFormula: `${Math.round(socialBase)} × 0.8%` },
    { name: '公积金', employee: housingBase * (employeeHousingRate / 100), employer: housingBase * (employerHousingRate / 100), employeeFormula: `${Math.round(housingBase)} × ${employeeHousingRate}%`, employerFormula: `${Math.round(housingBase)} × ${employerHousingRate}%`, housing: true },
  ]

  return items.map((item) => ({ ...item, subtotal: item.employee + item.employer }))
}

export function calculateMonth(salary: number, month: number, startMonth: number, deduction: number, insuranceItems: InsuranceItem[]): MonthlyCalculation {
  const monthsWorked = Math.max(0, month - startMonth + 1)
  if (monthsWorked === 0) {
    return {
      employeeInsurance: 0,
      employerInsurance: 0,
      monthsWorked,
      cumulativeSalary: 0,
      cumulativeInsurance: 0,
      taxable: 0,
      bracket: taxBrackets[0],
      cumulativeTax: 0,
      currentTax: 0,
      takeHome: 0,
    }
  }

  const employeeInsurance = insuranceItems.reduce((sum, item) => sum + item.employee, 0)
  const employerInsurance = insuranceItems.reduce((sum, item) => sum + item.employer, 0)
  const cumulativeSalary = salary * monthsWorked
  const cumulativeInsurance = employeeInsurance * monthsWorked
  const cumulativeDeductions = deduction * monthsWorked
  const taxable = Math.max(0, cumulativeSalary - cumulativeInsurance - cumulativeDeductions - 5000 * monthsWorked)
  const bracket = getBracket(taxable)
  const cumulativeTax = Math.max(0, taxable * bracket.rate - bracket.quick)
  const previous = month > startMonth ? calculateMonth(salary, month - 1, startMonth, deduction, insuranceItems).cumulativeTax : 0
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
    takeHome: salary - employeeInsurance - currentTax,
  }
}
