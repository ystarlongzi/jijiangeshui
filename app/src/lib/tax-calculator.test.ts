import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateInsurance, calculateMonth, clamp, getBracket } from './tax-calculator'
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

test('累计应纳税所得额在 36000 元临界点内外使用不同税率档', () => {
  const firstBracket = getBracket(36000)
  const secondBracket = getBracket(36000.01)

  assert.equal(Math.round(firstBracket.rate * 100), 3)
  assert.equal(firstBracket.quick, 0)
  assert.equal(Math.round(secondBracket.rate * 100), 10)
  assert.equal(secondBracket.quick, 2520)
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

test('社保和公积金基数可以不同，分别影响对应项目', () => {
  const insurance = calculateInsurance(cityRules.beijing, 20000, 10000, 12, 12)
  const pension = insurance.find((item) => item.name === '养老保险')
  const housing = insurance.find((item) => item.housing)
  const result = calculateMonth(20000, 8, 1, 0, insurance)

  assert.equal(pension?.employee, 1600)
  assert.equal(housing?.employee, 1200)
  assert.equal(result.employeeInsurance, 3300)
  assert.equal(result.taxable, 93600)
  assert.equal(result.currentTax, 1170)
  assert.equal(result.takeHome, 15530)
})

test('缴费基数超出城市范围时可以按规则上下限估算', () => {
  const rule = cityRules.beijing
  const socialBase = clamp(1000, rule.socialMin, rule.socialMax)
  const housingBase = clamp(999999, rule.housingMin, rule.housingMax)
  const insurance = calculateInsurance(rule, socialBase, housingBase, 12, 12)
  const pension = insurance.find((item) => item.name === '养老保险')
  const housing = insurance.find((item) => item.housing)

  assert.equal(socialBase, rule.socialMin)
  assert.equal(housingBase, rule.housingMax)
  assert.equal(pension?.employeeFormula, `${rule.socialMin} × 8%`)
  assert.equal(housing?.employeeFormula, `${rule.housingMax} × 12%`)
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
