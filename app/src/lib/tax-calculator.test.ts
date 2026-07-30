import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateInsurance, calculateMonth } from './tax-calculator'
import { cityRules } from './tax-rules'

test('北京工资薪金累计预扣：2 万月薪在 8 月进入 10% 档', () => {
  const insurance = calculateInsurance(cityRules.beijing, 20000, 20000, 12, 12)
  const result = calculateMonth(20000, 8, 1, 0, insurance)

  assert.equal(result.employeeInsurance, 4500)
  assert.equal(result.taxable, 84000)
  assert.equal(Math.round(result.bracket.rate * 100), 10)
  assert.equal(result.currentTax, 1050)
  assert.equal(result.cumulativeTax, 5880)
  assert.equal(result.takeHome, 14450)
})

test('年中入职：计算月份早于入职月份时不产生工资和税额', () => {
  const insurance = calculateInsurance(cityRules.beijing, 20000, 20000, 12, 12)
  const result = calculateMonth(20000, 3, 4, 0, insurance)

  assert.equal(result.monthsWorked, 0)
  assert.equal(result.cumulativeSalary, 0)
  assert.equal(result.employeeInsurance, 0)
  assert.equal(result.currentTax, 0)
  assert.equal(result.takeHome, 0)
})

test('专项附加扣除会降低累计应纳税所得额和本月个税', () => {
  const insurance = calculateInsurance(cityRules.beijing, 20000, 20000, 12, 12)
  const result = calculateMonth(20000, 8, 1, 2000, insurance)

  assert.equal(result.taxable, 68000)
  assert.equal(result.currentTax, 850)
  assert.equal(result.takeHome, 14650)
})

test('公积金比例可在 3% 到 12% 间改变个人缴费', () => {
  const lowHousing = calculateInsurance(cityRules.beijing, 20000, 20000, 3, 12)
  const highHousing = calculateInsurance(cityRules.beijing, 20000, 20000, 12, 12)

  assert.equal(lowHousing.find((item) => item.housing)?.employee, 600)
  assert.equal(highHousing.find((item) => item.housing)?.employee, 2400)
})

test('城市规则会影响单位缴费和规则版本日期', () => {
  const beijing = calculateInsurance(cityRules.beijing, 20000, 20000, 12, 12)
  const shenzhen = calculateInsurance(cityRules.shenzhen, 20000, 20000, 12, 12)
  const beijingEmployerSocial = beijing.filter((item) => !item.housing).reduce((sum, item) => sum + item.employer, 0)
  const shenzhenEmployerSocial = shenzhen.filter((item) => !item.housing).reduce((sum, item) => sum + item.employer, 0)

  assert.equal(cityRules.beijing.effective, '2026-07-01')
  assert.equal(cityRules.shenzhen.effective, '2026-07-01')
  assert.ok(shenzhenEmployerSocial < beijingEmployerSocial)
})
