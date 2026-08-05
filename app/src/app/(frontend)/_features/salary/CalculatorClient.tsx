'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Copy, Download } from 'lucide-react'
import { cityRules as fallbackCityRules, getCityRuleForMonth, getCityRuleForMonthStrict, getContributionBaseRule, resolveCityRuleForMonth, taxBrackets as fallbackTaxBrackets, type CityRule } from '@/lib/tax-rules'
import { calculateInsurance, calculateMonthFromSeries, clamp, type InsuranceItem } from '@/lib/tax-calculator'
import { auditCityRule, getRuleQualityStatus } from '@/lib/city-rule-quality'
import { getValidatedHousingRateOptions, validateCityRuleInputs } from '@/lib/city-rule-validation'
import { currentYear } from '@/lib/site'
import { specialDeductionGroups as fallbackDeductionGroups, specialDeductionItems as fallbackDeductionItems } from '@/lib/special-deductions'
import type { IncomeTaxRuleDataset, IncomeTaxYearRules } from '@/lib/income-tax-rule-types'
import { parseAmountParam, parseIntegerParam } from '@/lib/url-params'
import SiteHeader from '../../_components/SiteHeader'
import SiteFooter from '../../_components/SiteFooter'
import { Button } from '../../_components/Button'
import Toast from '../../_components/Toast'
import FormField from '../../_components/FormField'
import MoneyInput from '../../_components/MoneyInput'
import Panel from '../../_components/Panel'
import SelectField from '../../_components/SelectField'
import CitySelect from '../../_components/CitySelect'
import { useMoneyFormat } from '../../_components/MoneyFormatProvider'
import SpecialDeductionSelector from '../special-deductions/SpecialDeductionSelector'
import RuleSourcePanel from '../../_components/RuleSourcePanel'
import DataTable from '../../_components/DataTable'
import TrackedLink from '../../_components/TrackedLink'
import ValidationPanel from '../../_components/ValidationPanel'
import RuleBoundaryNotice from '../../_components/RuleBoundaryNotice'
import ResultActions, { ResultActionButton } from '../../_components/ResultActions/ResultActions'
import useCityLocator from '../../_hooks/useCityLocator'
import { trackEvent } from '../../_lib/analytics'
import { downloadCsv } from '../../_lib/csv'
import { formatDateOnly } from '../../_lib/date'
import styles from './CalculatorClient.module.css'

const rateRanges = ['不超过 36,000 元', '超过 36,000 元至 144,000 元', '超过 144,000 元至 300,000 元', '超过 300,000 元至 420,000 元', '超过 420,000 元至 660,000 元', '超过 660,000 元至 960,000 元', '超过 960,000 元']

type CalculatorClientProps = {
  rules?: Record<string, CityRule>
  cityRuleStatus?: {
    source: 'payload' | 'fallback'
    ruleSourcesByCity: Record<string, 'payload' | 'fallback'>
    fallbackReason?: string
  }
  incomeTaxRules?: IncomeTaxRuleDataset
}

export default function CalculatorClient({ rules = fallbackCityRules, cityRuleStatus, incomeTaxRules }: CalculatorClientProps) {
  const { money } = useMoneyFormat()
  const cityRules = rules
  const [city, setCity] = useState('beijing')
  const [taxYear, setTaxYear] = useState(incomeTaxRules?.availableYears[0] || currentYear)
  const [salary, setSalary] = useState(20000)
  const [salaryMode, setSalaryMode] = useState<'fixed' | 'monthly'>('fixed')
  const [monthlySalaries, setMonthlySalaries] = useState<number[]>(Array.from({ length: 12 }, () => 20000))
  const [month, setMonth] = useState(8)
  const [startMonth, setStartMonth] = useState(1)
  const [socialBase, setSocialBase] = useState(20000)
  const [housingBase, setHousingBase] = useState(20000)
  const [editingSocial, setEditingSocial] = useState(false)
  const [editingHousing, setEditingHousing] = useState(false)
  const [employeeHousingRate, setEmployeeHousingRate] = useState(12)
  const [employerHousingRate, setEmployerHousingRate] = useState(12)
  const [deductionAmount, setDeductionAmount] = useState(0)
  const [deductionSelections, setDeductionSelections] = useState<Record<string, string>>({})
  const [deductionDialogOpen, setDeductionDialogOpen] = useState(false)
  const [calculationOpen, setCalculationOpen] = useState(false)
  const [toast, setToast] = useState('')

  const selectedCityRule = cityRules[city] || cityRules.beijing || fallbackCityRules.beijing
  const yearRules: IncomeTaxYearRules = incomeTaxRules?.rulesByYear[String(taxYear)] || {
    year: taxYear,
    taxBrackets: fallbackTaxBrackets,
    specialDeductionGroups: fallbackDeductionGroups,
    specialDeductionItems: fallbackDeductionItems,
    taxRateAvailable: false,
    specialDeductionAvailable: false,
    source: 'unavailable',
    missingReasons: [`${taxYear} 年税率和专项附加扣除规则尚未加载。`],
  }
  // 严格按用户选择的年度和月份找政策；找不到时只用于渲染表单，后面的校验会阻止计算。
  const cityRuleResolution = resolveCityRuleForMonth(selectedCityRule, taxYear, month)
  const rule = cityRuleResolution.rule
  const cityRuleLoaded = !cityRuleStatus || (cityRuleStatus.source === 'payload' && cityRuleStatus.ruleSourcesByCity[city] === 'payload')
  const ruleSourceDate = yearRules.checkedAt || rule.sources.find((source) => source.checkedAt)?.checkedAt || rule.effective
  const displayRuleSourceDate = formatDateOnly(ruleSourceDate)
  const ruleSourceLinks = rule.sources
    .filter((source): source is typeof source & { url: string } => Boolean(source.url))
    .map((source) => ({ label: source.title, url: source.url }))
  const socialBaseRule = getContributionBaseRule(rule, 'social')
  const housingBaseRule = getContributionBaseRule(rule, 'housingFund')
  const cityHousingRateOptions = useMemo(() => getValidatedHousingRateOptions(rule), [rule])
  const inputValidation = useMemo(() => validateCityRuleInputs(rule, {
    socialBase,
    housingBase,
    employeeHousingRate,
    employerHousingRate,
  }), [rule, socialBase, housingBase, employeeHousingRate, employerHousingRate])
  const ruleQualityIssues = useMemo(() => auditCityRule(city, rule), [city, rule])
  const hasRuleQualityErrors = getRuleQualityStatus(ruleQualityIssues) === 'error'
  const deduction = deductionAmount
  const selectedDeductionItems = Object.values(deductionSelections).map((id) => yearRules.specialDeductionItems.find((item) => item.id === id)).filter(Boolean)
  const activeSalary = salaryMode === 'fixed' ? salary : monthlySalaries[month - 1] || 0
  const salaryForBase = salaryMode === 'fixed' ? salary : activeSalary
  const salariesForCalculation = useMemo(() => salaryMode === 'fixed' ? Array.from({ length: 12 }, () => salary) : monthlySalaries, [salaryMode, salary, monthlySalaries])

  useEffect(() => {
    if (!editingSocial) setSocialBase(clamp(salaryForBase, socialBaseRule.min, socialBaseRule.max))
    if (!editingHousing) setHousingBase(clamp(salaryForBase, housingBaseRule.min, housingBaseRule.max))
  }, [city, taxYear, salaryForBase, rule, editingSocial, editingHousing])

  useEffect(() => {
    if (cityHousingRateOptions.length === 0) return
    const fallbackRate = cityHousingRateOptions[cityHousingRateOptions.length - 1]
    setEmployeeHousingRate((current) => cityHousingRateOptions.includes(current) ? current : fallbackRate)
    setEmployerHousingRate((current) => cityHousingRateOptions.includes(current) ? current : fallbackRate)
  }, [cityHousingRateOptions])

  const insuranceByMonth = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const currentMonth = index + 1
    // 历史月份规则缺失时沿用 2026 年已录入的最近规则，同时在页面上明确标注为估算。
    const monthRule = resolveCityRuleForMonth(selectedCityRule, taxYear, currentMonth).rule
    const monthSalary = salaryMode === 'fixed' ? salary : monthlySalaries[index] || 0
    const monthSocialBaseRule = getContributionBaseRule(monthRule, 'social')
    const monthHousingBaseRule = getContributionBaseRule(monthRule, 'housingFund')
    // 未手动编辑基数时，每月按当月工资和当月城市规则重新取值；手动编辑则沿用用户输入。
    const monthSocialBase = editingSocial ? socialBase : clamp(monthSalary, monthSocialBaseRule.min, monthSocialBaseRule.max)
    const monthHousingBase = editingHousing ? housingBase : clamp(monthSalary, monthHousingBaseRule.min, monthHousingBaseRule.max)
    return calculateInsurance(monthRule, monthSocialBase, monthHousingBase, employeeHousingRate, employerHousingRate)
  }), [selectedCityRule, taxYear, salaryMode, salary, monthlySalaries, editingSocial, editingHousing, socialBase, housingBase, employeeHousingRate, employerHousingRate])
  const insurance = insuranceByMonth[month - 1] || []
  const result = useMemo(() => calculateMonthFromSeries(
    salariesForCalculation,
    month,
    startMonth,
    deduction,
    insurance,
    { taxBrackets: yearRules.taxBrackets, insuranceByMonth },
  ), [salariesForCalculation, month, startMonth, deduction, insurance, yearRules.taxBrackets, insuranceByMonth])
  const previousMonthResult = useMemo(() => month > startMonth
    ? calculateMonthFromSeries(salariesForCalculation, month - 1, startMonth, deduction, insurance, { taxBrackets: yearRules.taxBrackets, insuranceByMonth })
    : null, [salariesForCalculation, month, startMonth, deduction, insurance, yearRules.taxBrackets, insuranceByMonth])
  const rate = Math.round(result.bracket.rate * 100)
  const socialItems = insurance.filter((item) => !item.housing)
  const housingItems = insurance.filter((item) => item.housing)
  const socialEmployee = socialItems.reduce((sum, item) => sum + item.employee, 0)
  const socialEmployer = socialItems.reduce((sum, item) => sum + item.employer, 0)
  const housingEmployee = housingItems.reduce((sum, item) => sum + item.employee, 0)
  const housingEmployer = housingItems.reduce((sum, item) => sum + item.employer, 0)
  const takeHomePercent = activeSalary > 0 ? Math.round(result.takeHome / activeSalary * 100) : 0
  const wholeMoney = (value: number) => money(value, 0)
  const flowTotal = Math.max(1, activeSalary)
  const ladderPosition = Math.max(0, yearRules.taxBrackets.findIndex((item) => item.rate === result.bracket.rate)) / Math.max(1, yearRules.taxBrackets.length - 1) * 100
  const isSalaryInvalid = activeSalary <= 0
  const isMonthInvalid = month < startMonth
  const isSocialBaseInvalid = !inputValidation.socialBase.valid
  const isHousingBaseInvalid = !inputValidation.housingBase.valid
  const isEmployeeHousingRateInvalid = !inputValidation.employeeHousingRate.valid
  const isEmployerHousingRateInvalid = !inputValidation.employerHousingRate.valid
  const isDeductionInvalid = deductionAmount > activeSalary
  const housingRateOptionsText = cityHousingRateOptions.map((rate) => `${rate}%`).join('、')
  const missingCityRuleMonths = useMemo(() => Array.from({ length: Math.max(0, month - startMonth + 1) }, (_, index) => startMonth + index)
    .filter((targetMonth) => !getCityRuleForMonthStrict(selectedCityRule, taxYear, targetMonth)), [selectedCityRule, taxYear, month, startMonth])
  const cityRuleFallbackMessage = missingCityRuleMonths.length > 0 || cityRuleResolution.usedFallback
    ? `${taxYear} 年${missingCityRuleMonths.length > 0 ? ` ${missingCityRuleMonths.join('、')} 月` : ` ${month} 月`}尚无单独的城市缴费规则，当前按 ${formatDateOnly(rule.effective)} 起的最近可用规则估算。`
    : ''
  const blockingRuleMessages = [
    !cityRuleLoaded ? `当前城市规则没有从 CMS 成功加载${cityRuleStatus?.fallbackReason ? `（${cityRuleStatus.fallbackReason}）` : ''}，暂时无法可靠测算。` : '',
    ...yearRules.missingReasons,
  ].filter(Boolean)
  const ruleAvailabilityMessages = [
    cityRuleFallbackMessage,
    ...blockingRuleMessages,
  ].filter(Boolean)
  const validationMessages = [
    ...ruleAvailabilityMessages,
    hasRuleQualityErrors ? `${rule.label} 当前规则信息不完整，暂时无法可靠测算，请稍后再试或查看城市规则。` : '',
    isSalaryInvalid ? '税前月薪需要大于 0，才能计算工资到手和个人所得税。' : '',
    isMonthInvalid ? '计算月份不能早于入职月份，请调整月份后再查看结果。' : '',
    isSocialBaseInvalid ? `社保缴费基数需要在 ${wholeMoney(socialBaseRule.min)} - ${wholeMoney(socialBaseRule.max)} 之间。` : '',
    isHousingBaseInvalid ? `公积金缴费基数需要在 ${wholeMoney(housingBaseRule.min)} - ${wholeMoney(housingBaseRule.max)} 之间。` : '',
    isEmployeeHousingRateInvalid ? cityHousingRateOptions.length > 0 ? `公积金个人比例需从 ${housingRateOptionsText} 中选择。` : '当前城市暂无可用的公积金缴费比例规则，暂时无法可靠测算。' : '',
    isEmployerHousingRateInvalid ? cityHousingRateOptions.length > 0 ? `公积金单位比例需从 ${housingRateOptionsText} 中选择。` : '当前城市暂无可用的公积金缴费比例规则，暂时无法可靠测算。' : '',
    isDeductionInvalid ? '专项附加扣除已超过税前月薪，请确认是否填入了月度扣除额。' : '',
  ].filter(Boolean)
  const socialSalaryOutsideRange = !editingSocial && activeSalary > 0 && (activeSalary < socialBaseRule.min || activeSalary > socialBaseRule.max)
  const housingSalaryOutsideRange = !editingHousing && activeSalary > 0 && (activeSalary < housingBaseRule.min || activeSalary > housingBaseRule.max)
  const boundaryMessages = [
    socialSalaryOutsideRange
      ? `税前收入超出社保缴费基数范围，当前按${activeSalary < socialBaseRule.min ? '最低' : '最高'}基数 ${wholeMoney(socialBase)} 估算。`
      : !isSocialBaseInvalid && socialBase === socialBaseRule.min
        ? `社保缴费基数已达到城市允许的最低值 ${wholeMoney(socialBaseRule.min)}。`
        : !isSocialBaseInvalid && socialBase === socialBaseRule.max
          ? `社保缴费基数已达到城市允许的最高值 ${wholeMoney(socialBaseRule.max)}。`
          : '',
    housingSalaryOutsideRange
      ? `税前收入超出公积金缴费基数范围，当前按${activeSalary < housingBaseRule.min ? '最低' : '最高'}基数 ${wholeMoney(housingBase)} 估算。`
      : !isHousingBaseInvalid && housingBase === housingBaseRule.min
        ? `公积金缴费基数已达到城市允许的最低值 ${wholeMoney(housingBaseRule.min)}。`
        : !isHousingBaseInvalid && housingBase === housingBaseRule.max
          ? `公积金缴费基数已达到城市允许的最高值 ${wholeMoney(housingBaseRule.max)}。`
          : '',
  ].filter(Boolean)
  const calculationBlocked = [
    ...blockingRuleMessages,
    hasRuleQualityErrors ? `${rule.label} 当前规则信息不完整，暂时无法可靠测算，请稍后再试或查看城市规则。` : '',
    isSalaryInvalid ? '税前月薪需要大于 0，才能计算工资到手和个人所得税。' : '',
    isMonthInvalid ? '计算月份不能早于入职月份，请调整月份后再查看结果。' : '',
    isSocialBaseInvalid ? '社保缴费基数超出允许范围。' : '',
    isHousingBaseInvalid ? '公积金缴费基数超出允许范围。' : '',
    isEmployeeHousingRateInvalid ? '公积金个人比例不在当前城市规则范围内。' : '',
    isEmployerHousingRateInvalid ? '公积金单位比例不在当前城市规则范围内。' : '',
    isDeductionInvalid ? '专项附加扣除已超过税前月薪。' : '',
  ].filter(Boolean).length > 0
  const flowWidth = (value: number) => `${Math.max(0, Math.min(100, value / flowTotal * 100))}%`

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }
  const locate = useCityLocator(notify, { rules: cityRules, onLocated: setCity })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedCity = params.get('city')
    const requestedYear = parseIntegerParam(params.get('year'), 2000, 2100)
    const requestedDeduction = parseAmountParam(params.get('deduction'))
    const requestedSalary = parseAmountParam(params.get('salary'))
    const requestedSalaryMode = params.get('salaryMode') === 'monthly' ? 'monthly' : 'fixed'
    const requestedSalaries = (params.get('salaries') || '').split(',').map((item) => parseAmountParam(item)).filter((item) => item >= 0)
    const requestedSocialBase = parseAmountParam(params.get('socialBase'))
    const requestedHousingBase = parseAmountParam(params.get('housingBase'))
    const requestedMonth = parseIntegerParam(params.get('month'), 1, 12)
    const requestedStartMonth = parseIntegerParam(params.get('startMonth'), 1, 12)
    const requestedEmployeeHousingRate = parseIntegerParam(params.get('employeeHousingRate'), 3, 12)
    const requestedEmployerHousingRate = parseIntegerParam(params.get('employerHousingRate'), 3, 12)

    if (requestedCity && cityRules[requestedCity]) setCity(requestedCity)
    if (requestedYear && incomeTaxRules?.availableYears.includes(requestedYear)) setTaxYear(requestedYear)
    if (requestedSalary > 0) setSalary(requestedSalary)
    if (requestedSalaryMode === 'monthly' && requestedSalaries.length === 12) {
      setSalaryMode('monthly')
      setMonthlySalaries(requestedSalaries)
    }
    if (requestedSocialBase > 0) {
      setSocialBase(requestedSocialBase)
      setEditingSocial(true)
    }
    if (requestedHousingBase > 0) {
      setHousingBase(requestedHousingBase)
      setEditingHousing(true)
    }
    if (requestedMonth) setMonth(requestedMonth)
    if (requestedStartMonth) setStartMonth(requestedStartMonth)
    const requestedRule = getCityRuleForMonth(
      requestedCity && cityRules[requestedCity] ? cityRules[requestedCity] : cityRules.beijing || fallbackCityRules.beijing,
      requestedYear || taxYear,
      requestedMonth || month,
    )
    const requestedHousingRateOptions = getValidatedHousingRateOptions(requestedRule)
    if (requestedEmployeeHousingRate && requestedHousingRateOptions.includes(requestedEmployeeHousingRate)) setEmployeeHousingRate(requestedEmployeeHousingRate)
    if (requestedEmployerHousingRate && requestedHousingRateOptions.includes(requestedEmployerHousingRate)) setEmployerHousingRate(requestedEmployerHousingRate)
    if (requestedDeduction > 0) {
      setDeductionAmount(requestedDeduction)
      setDeductionSelections({})
      notify(`已带入专项附加扣除 ${money(requestedDeduction)} / 月`)
    }
  }, [])

  const reset = () => {
    setCity('beijing'); setTaxYear(incomeTaxRules?.availableYears[0] || currentYear); setSalary(20000); setMonth(8); setStartMonth(1); setSocialBase(20000); setHousingBase(20000)
    setSalaryMode('fixed'); setMonthlySalaries(Array.from({ length: 12 }, () => 20000)); setEditingSocial(false); setEditingHousing(false); setEmployeeHousingRate(12); setEmployerHousingRate(12); setDeductionAmount(0); setDeductionSelections({}); setDeductionDialogOpen(false); setCalculationOpen(false)
    notify('已恢复城市默认设置')
  }

  const saveDeductionSelections = (value: Record<string, string>, amount: number) => {
    setDeductionSelections(value)
    setDeductionAmount(amount)
    setDeductionDialogOpen(false)
    notify('已回填专项附加扣除')
  }
  const switchSalaryMode = (mode: 'fixed' | 'monthly') => {
    if (mode === salaryMode) return
    if (mode === 'monthly') {
      setMonthlySalaries(Array.from({ length: 12 }, () => salary))
      setSalaryMode('monthly')
      return
    }

    setSalary(monthlySalaries[month - 1] || salary)
    setSalaryMode('fixed')
  }
  const updateActiveSalary = (value: number) => {
    if (salaryMode === 'fixed') {
      setSalary(value)
      return
    }

    setMonthlySalaries((current) => current.map((item, index) => index === month - 1 ? value : item))
  }
  const updateMonthlySalary = (targetMonth: number, value: number) => {
    setMonthlySalaries((current) => current.map((item, index) => index === targetMonth - 1 ? value : item))
  }
  const calculate = () => {
    if (calculationBlocked) {
      trackEvent('calculate_blocked', { calculator: 'salary', city, month, salaryMode, ruleQualityStatus: getRuleQualityStatus(ruleQualityIssues) })
      notify('请先修正输入提示')
      return
    }

    trackEvent('calculate_complete', { calculator: 'salary', city, month, salaryMode, ruleQualityStatus: getRuleQualityStatus(ruleQualityIssues) })
    notify('已更新计算结果')
  }
  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/calculator'
    url.hash = 'calculator'
    url.search = new URLSearchParams({
      city,
      year: String(taxYear),
      salary: String(Math.round(salary)),
      salaryMode,
      salaries: monthlySalaries.map((value) => String(Math.round(value))).join(','),
      month: String(month),
      startMonth: String(startMonth),
      socialBase: String(Math.round(socialBase)),
      housingBase: String(Math.round(housingBase)),
      employeeHousingRate: String(employeeHousingRate),
      employerHousingRate: String(employerHousingRate),
      deduction: String(Math.round(deductionAmount)),
    }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      trackEvent('share_link', { calculator: 'salary', city, month })
      notify('已复制当前计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }
  const copyPayslip = async () => {
    const lines = [
      `工资薪金测算：${rule.label} · ${taxYear} 年 ${month} 月`,
      `税前收入：${money(activeSalary, 2)}`,
      `到手工资：${money(result.takeHome, 2)}`,
      `本月个税：${money(result.currentTax, 2)}`,
      `个人社保：${money(socialEmployee, 2)}`,
      `个人公积金：${money(housingEmployee, 2)}`,
      `单位社保：${money(socialEmployer, 2)}`,
      `单位公积金：${money(housingEmployer, 2)}`,
      `累计应纳税所得额：${money(result.taxable, 2)}`,
      `适用预扣率：${rate}%`,
      `规则核对日期：${displayRuleSourceDate}`,
      '结果仅供测算，最终以个税 APP、扣缴单位或税务机关口径为准。',
    ].join('\n')

    try {
      await navigator.clipboard.writeText(lines)
      trackEvent('copy_result', { calculator: 'salary', city, month, type: 'payslip' })
      notify('已复制工资条测算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动选择结果')
    }
  }
  const previousRate = previousMonthResult ? Math.round(previousMonthResult.bracket.rate * 100) : rate
  const taxChange = result.currentTax - (previousMonthResult?.currentTax || 0)
  const taxYearOptions = (incomeTaxRules?.availableYears || [currentYear]).map((year) => ({ value: year, label: `${year} 年` }))
  const formatTaxMessage = calculationBlocked
    ? '当前年度或城市规则尚未完成加载，系统已停止估算，请先补齐规则后再查看结果。'
    : result.taxable <= 0
      ? '累计收入扣除个人缴费、基本减除费用和专项附加扣除后不超过 0，本月暂不需要预扣个税。'
      : result.bracket.rate > (previousMonthResult?.bracket.rate || result.bracket.rate)
        ? `本月累计应纳税所得额跨入 ${rate}% 档，预扣率由 ${previousRate}% 提高到 ${rate}%，所以本月个税会明显增加。`
        : taxChange > 1
          ? `本月个税较上月增加 ${money(taxChange, 2)}，主要受累计收入、当月缴费或扣除变化影响。`
          : taxChange < -1
            ? `本月个税较上月减少 ${money(Math.abs(taxChange), 2)}，通常与当月收入、缴费或累计扣除变化有关。`
            : `当前累计应纳税所得额处于 ${rate}% 预扣率档，累计预扣法会根据全年累计收入和扣除逐月结算。`

  return <div className="app-shell">
    <SiteHeader active="calculator" />

    <main id="top" className={styles.pageContent}>
      <section className="page-intro" id="calculator"><div><p className={styles.eyebrow}>工资薪金 · {taxYear}</p><h1>先看懂，再算清。</h1><p className="intro-copy">选择缴费城市，输入工资和必要扣除，看到本月到手与全年预扣明细。</p></div><div className="rule-date"><span className="status-dot" /><span>规则核对日期</span><strong>{displayRuleSourceDate}</strong></div></section>

      <section className="workspace-grid" aria-label="个税计算器">
        <Panel as="form" className="input-panel" onSubmit={(event) => { event.preventDefault(); calculate() }}>
          <div className="panel-heading"><h2>计算条件</h2></div>
          <CitySelect id="city" label="缴费城市" value={city} onChange={setCity} rules={cityRules} invalid={hasRuleQualityErrors} action={<span className="city-actions"><Button className={styles.formTextAction} variant="text" type="button" onClick={locate}>自动定位</Button><TrackedLink className={styles.formTextAction} href={`/city/${city}`} eventPayload={{ module: 'salary_form', label: '查看城市规则', city }}>查看规则</TrackedLink></span>} />
          <FormField htmlFor="salary" label={salaryMode === 'fixed' ? '税前月薪' : `${month} 月税前收入`} error={isSalaryInvalid ? '税前收入需要大于 0。' : ''} action={<span className={styles.salaryModeRow}><Button className={styles.salaryModeButton} variant="text" type="button" aria-pressed={salaryMode === 'fixed'} onClick={() => switchSalaryMode('fixed')}>固定月薪</Button><Button className={styles.salaryModeButton} variant="text" type="button" aria-pressed={salaryMode === 'monthly'} onClick={() => switchSalaryMode('monthly')}>逐月填写</Button></span>}><MoneyInput id="salary" className={isSalaryInvalid ? 'input-error' : ''} value={activeSalary} onChange={updateActiveSalary} />{salaryMode === 'monthly' && <div className="monthly-salary-grid" aria-label="逐月税前收入">{monthlySalaries.map((value, index) => <label className={index + 1 === month ? 'current' : ''} key={index + 1}><span>{index + 1} 月</span><MoneyInput value={value} onChange={(next) => updateMonthlySalary(index + 1, next)} /></label>)}</div>}</FormField>
          <div className={styles.fieldGrid}><SelectField className={styles.compactField} id="taxYear" label="纳税年度" value={taxYear} onChange={setTaxYear} options={taxYearOptions} /><SelectField className={styles.compactField} id="month" label="计算月份" value={month} onChange={setMonth} invalid={isMonthInvalid} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /><SelectField className={styles.compactField} id="startMonth" label="入职月份" value={startMonth} onChange={setStartMonth} invalid={isMonthInvalid} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /></div>
          {isMonthInvalid && <p className={styles.fieldError}>计算月份不能早于入职月份。</p>}
          <div className={styles.sectionDivider} />
          <div className="panel-heading compact-heading"><h3>缴费基数与比例</h3></div>
          <div className="base-editor">
            <BaseField label={socialBaseRule.label} value={socialBase} min={socialBaseRule.min} max={socialBaseRule.max} invalid={isSocialBaseInvalid} editing={editingSocial} onEdit={() => setEditingSocial(!editingSocial)} onChange={setSocialBase} />
            <BaseField label={housingBaseRule.label} value={housingBase} min={housingBaseRule.min} max={housingBaseRule.max} invalid={isHousingBaseInvalid} editing={editingHousing} onEdit={() => setEditingHousing(!editingHousing)} onChange={setHousingBase} />
          </div>
          <div className={styles.ratioGrid}><RateSelect label="公积金个人比例" value={employeeHousingRate} options={cityHousingRateOptions} invalid={isEmployeeHousingRateInvalid} onChange={setEmployeeHousingRate} /><RateSelect label="公积金单位比例" value={employerHousingRate} options={cityHousingRateOptions} invalid={isEmployerHousingRateInvalid} onChange={setEmployerHousingRate} /></div>
          <FormField className={styles.deductionBlock} htmlFor="deductionAmount" label="专项附加扣除" action={<Button className={styles.formTextAction} variant="text" type="button" onClick={() => setDeductionDialogOpen(true)}>选择项目</Button>} meta={selectedDeductionItems.length > 0 ? `已选择 ${selectedDeductionItems.map((item) => item?.label).join('、')}。` : ''} error={isDeductionInvalid ? '这里填写的是本月扣除额，不能高于税前月薪。' : ''}><MoneyInput id="deductionAmount" className={isDeductionInvalid ? 'input-error' : ''} value={deductionAmount} onChange={(value) => { setDeductionAmount(value); setDeductionSelections({}) }} /></FormField>
          <ValidationPanel messages={validationMessages} title="请确认输入" />
          <RuleBoundaryNotice messages={boundaryMessages} title="边界提醒" />
          <div className={styles.formActions}><Button variant="primary" type="submit" disabled={calculationBlocked}>开始计算</Button><Button variant="secondary" type="button" onClick={reset}>清空</Button></div><p className={styles.formFootnote}>结果仅供测算，最终以个税 APP、扣缴单位或税务机关口径为准。</p>
        </Panel>

        <div className="results-column">
          {calculationBlocked ? <RuleUnavailablePanel messages={validationMessages} /> : <>
            <Panel as="section" className="result-panel" aria-live="polite"><div className="result-topline"><span className="result-context">{rule.label} · {taxYear} 年 {month} 月</span><span className="result-badge">累计预扣</span></div><div className="take-home-block"><span>到手工资</span><strong>{money(result.takeHome, 2)}</strong><small>税前 <b>{wholeMoney(activeSalary)}</b></small></div>
              <div className="wage-flow"><div className="wage-flow-heading"><strong>本月工资流向</strong><span>到手 {takeHomePercent}%</span></div><div className="flow-bar" aria-hidden="true"><span className="flow-segment flow-take-home" style={{ width: flowWidth(result.takeHome) }} /><span className="flow-segment flow-social" style={{ width: flowWidth(socialEmployee) }} /><span className="flow-segment flow-housing" style={{ width: flowWidth(housingEmployee) }} /><span className="flow-segment flow-tax" style={{ width: flowWidth(result.currentTax) }} /></div><div className="flow-legend"><FlowLegend className="flow-take-home-dot" label="到手工资" value={result.takeHome} money={money} /><FlowLegend className="flow-social-dot" label="个人社保" value={socialEmployee} money={money} /><FlowLegend className="flow-housing-dot" label="公积金" value={housingEmployee} money={money} /><FlowLegend className="flow-tax-dot" label="个人所得税" value={result.currentTax} money={money} /></div></div>
              {cityRuleFallbackMessage && <RuleBoundaryNotice messages={[cityRuleFallbackMessage]} title="城市规则估算口径" />}<div className="result-explanation">{formatTaxMessage}</div><div className="tax-ladder"><div className="tax-ladder-heading"><span>当前预扣率档位</span><strong>{rate}% 档</strong></div><div className="tax-ladder-rail"><span className="tax-ladder-progress" style={{ width: `${ladderPosition}%` }} /><span className="tax-ladder-marker" style={{ left: `${ladderPosition}%` }} /></div><div className="tax-ladder-levels">{yearRules.taxBrackets.map((item) => Math.round(item.rate * 100)).map((item) => <span key={item} className={item === rate ? 'active' : ''}>{item}%</span>)}</div></div><ResultActions><ResultActionButton onClick={() => { const next = !calculationOpen; setCalculationOpen(next); trackEvent('result_expand', { calculator: 'salary', expanded: next }) }}>查看计算过程 <span>→</span></ResultActionButton><ResultActionButton onClick={copyPayslip}><Copy size={14} />复制工资条</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions>{calculationOpen && <div className="calculation-detail"><div><span>累计应纳税所得额</span><strong>{wholeMoney(result.taxable)}</strong></div><div><span>累计应预扣税额</span><strong>{wholeMoney(result.cumulativeTax)}</strong></div><div><span>预扣率 × 应纳税所得额</span><strong>{rate}% × {wholeMoney(result.taxable)}</strong></div><div><span>速算扣除数</span><strong>{wholeMoney(result.bracket.quick)}</strong></div></div>}</Panel>
            <InsuranceTable insurance={insurance} month={month} year={taxYear} money={money} />
          </>}
        </div>
      </section>

      {!calculationBlocked && <AnnualTable salaries={salariesForCalculation} month={month} startMonth={startMonth} deduction={deduction} insurance={insurance} insuranceByMonth={insuranceByMonth} taxBrackets={yearRules.taxBrackets} year={taxYear} money={money} />}
      <RateTable brackets={yearRules.taxBrackets} year={taxYear} money={money} />
      <Faq />
      <RuleSourcePanel
        title="每个结果都有出处"
        description="计算口径参考国家税务总局及 12366 公开规则，政策变化后会更新规则版本和核对日期。"
        checkedAt={ruleSourceDate}
        links={[
          ...ruleSourceLinks,
          { label: '累计预扣法说明', url: 'https://www.chinatax.gov.cn/chinatax/n810341/n810760/c3959585/content.html' },
          { label: '专项附加扣除标准', url: 'https://fgk.chinatax.gov.cn/zcfgk/c100012/c5213592/content.html' },
        ]}
      />
      <SiteFooter />
    </main>
    <SpecialDeductionSelector
      groups={yearRules.specialDeductionGroups}
      items={yearRules.specialDeductionItems}
      open={deductionDialogOpen}
      value={deductionSelections}
      description="选择后会按月扣除额汇总，并回填到工资计算器。"
      onClose={() => setDeductionDialogOpen(false)}
      onSave={saveDeductionSelections}
    />
    <Toast message={toast} />
  </div>
}

function BaseField({ label, value, min, max, invalid, editing, onEdit, onChange }: { label: string; value: number; min: number; max: number; invalid: boolean; editing: boolean; onEdit: () => void; onChange: (value: number) => void }) {
  const { money } = useMoneyFormat()
  const range = (min: number, max: number) => `${money(min, 0)} - ${money(max, 0)}`
  return <FormField className={styles.baseField} label={label} action={<Button className={styles.editBaseButton} variant="text" type="button" aria-pressed={editing} onClick={onEdit}>{editing ? '完成' : '编辑'}</Button>} meta={`允许范围：${range(min, max)}`} error={invalid ? `${label}需要在允许范围内。` : ''}><MoneyInput className={[styles.smallInput, invalid ? 'input-error' : ''].filter(Boolean).join(' ')} value={value} min={min} max={max} readOnly={!editing} onChange={onChange} /></FormField>
}

function RateSelect({ label, value, options, invalid, onChange }: { label: string; value: number; options: number[]; invalid: boolean; onChange: (value: number) => void }) {
  return <SelectField className={styles.compactField} label={label} value={value} invalid={invalid} onChange={onChange} options={options.map((rate) => ({ value: rate, label: `${rate}%` }))} />
}

function FlowLegend({ className, label, value, money }: { className: string; label: string; value: number; money: (value: number, decimals?: number) => string }) {
  return <div><span className={`flow-dot ${className}`} /><span>{label}</span><strong>{money(value, 0)}</strong></div>
}

function RuleUnavailablePanel({ messages }: { messages: string[] }) {
  return <Panel as="section" className="result-panel" aria-live="polite">
    <RuleBoundaryNotice messages={messages} title="暂时无法计算" tone="error" />
    <p className="result-explanation">当前结果不会用未确认的规则代替。请稍后重试，或先到城市规则和 CMS 后台补齐对应年度的有效规则。</p>
  </Panel>
}

function ContributionSegment({ className, label, value, total, money }: { className: string; label: string; value: number; total: number; money: (value: number, decimals?: number) => string }) {
  const percent = total > 0 ? value / total * 100 : 0
  return (
    <div className="contribution-item">
      <span className={`contribution-dot ${className}`} />
      <span className="contribution-item-body">
        <span className="contribution-item-main">
          <span>{label}</span>
        </span>
        <span className="contribution-item-value">
          <strong>{money(value, 0)}</strong>
          <em>{Math.round(percent)}%</em>
        </span>
      </span>
    </div>
  )
}

function InsuranceTable({ insurance, month, year, money }: { insurance: InsuranceItem[]; month: number; year: number; money: (value: number, decimals?: number) => string }) {
  const social = insurance.filter((item) => !item.housing)
  const housing = insurance.filter((item) => item.housing)
  const sum = (items: InsuranceItem[], key: 'employee' | 'employer' | 'subtotal') => items.reduce((total, item) => total + item[key], 0)
  const socialEmployee = sum(social, 'employee')
  const socialEmployer = sum(social, 'employer')
  const housingEmployee = sum(housing, 'employee')
  const housingEmployer = sum(housing, 'employer')
  const contributionTotal = sum(insurance, 'subtotal')
  const contributionSegments = [
    { className: 'personal-social', label: '个人社保', value: socialEmployee },
    { className: 'personal-housing', label: '个人公积金', value: housingEmployee },
    { className: 'employer-social', label: '企业社保', value: socialEmployer },
    { className: 'employer-housing', label: '企业公积金', value: housingEmployer },
  ]
  const amountWithFormula = (amount: number, formula: string) => <>{money(amount, 2)}<span className="formula">{formula}</span></>
  const columns = [{ key: 'name', header: '缴纳项目' }, { key: 'employee', header: '个人缴纳' }, { key: 'employer', header: '企业缴纳' }, { key: 'subtotal', header: '小计' }]
  const tableRows = [
    ...social.map((item) => ({
      key: item.name,
      cells: { name: item.name, employee: amountWithFormula(item.employee, item.employeeFormula), employer: amountWithFormula(item.employer, item.employerFormula), subtotal: money(item.subtotal, 2) },
    })),
    { key: 'social-total', className: 'subtotal social-subtotal', tone: 'subtotal' as const, cells: { name: '社保合计', employee: money(sum(social, 'employee'), 2), employer: money(sum(social, 'employer'), 2), subtotal: money(sum(social, 'subtotal'), 2) } },
    ...housing.map((item) => ({
      key: item.name,
      className: 'housing-row',
      cells: { name: item.name, employee: amountWithFormula(item.employee, item.employeeFormula), employer: amountWithFormula(item.employer, item.employerFormula), subtotal: money(item.subtotal, 2) },
    })),
    { key: 'insurance-total', className: 'subtotal total-subtotal', tone: 'subtotal' as const, cells: { name: '社保、公积金合计', employee: money(sum(insurance, 'employee'), 2), employer: money(sum(insurance, 'employer'), 2), subtotal: money(sum(insurance, 'subtotal'), 2) } },
  ]
  const exportCsv = () => {
    const header = ['缴纳项目', '个人缴纳', '个人公式', '企业缴纳', '企业公式', '小计']
    const rows = [
      header,
      ...insurance.map((item) => [item.name, item.employee.toFixed(2), item.employeeFormula, item.employer.toFixed(2), item.employerFormula, item.subtotal.toFixed(2)]),
      ['社保合计', sum(social, 'employee').toFixed(2), '', sum(social, 'employer').toFixed(2), '', sum(social, 'subtotal').toFixed(2)],
      ['社保、公积金合计', sum(insurance, 'employee').toFixed(2), '', sum(insurance, 'employer').toFixed(2), '', sum(insurance, 'subtotal').toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'salary', type: 'insurance_detail', rows: insurance.length })
    downloadCsv(`五险一金汇缴明细-${year}-${month}月.csv`, rows)
  }

  return <Panel as="section" className="detail-panel"><div className="section-heading-row"><div className="heading-with-meta"><h2>五险一金汇缴明细</h2><span className="month-label">{year} 年 {month} 月</span></div><button className={styles.exportButton} type="button" onClick={exportCsv}><Download size={14} />导出 CSV</button></div><div className="contribution-chart" aria-label="社保公积金缴费占比"><div className="contribution-total"><span>本月汇缴总额</span><strong>{money(contributionTotal, 0)}</strong></div><div className="contribution-stack">{contributionSegments.map((item) => <span className={`contribution-segment ${item.className}`} style={{ '--segment-width': `${contributionTotal > 0 ? item.value / contributionTotal * 100 : 0}%` } as CSSProperties} key={item.label} title={`${item.label} ${money(item.value, 0)}`} />)}</div><div className="contribution-list">{contributionSegments.map((item) => <ContributionSegment key={item.label} {...item} total={contributionTotal} money={money} />)}</div></div><DataTable ariaLabel={`${year} 年 ${month} 月五险一金汇缴明细`} columns={columns} rows={tableRows} wrapperClassName="detail-table-wrap" tableClassName="insurance-table" /><p className="table-note">金额下方展示实际使用的缴费基数 × 比例，便于核对规则。</p></Panel>
}

function AnnualTable({ salaries, month, startMonth, deduction, insurance, insuranceByMonth, taxBrackets, year, money }: { salaries: number[]; month: number; startMonth: number; deduction: number; insurance: InsuranceItem[]; insuranceByMonth: InsuranceItem[][]; taxBrackets: typeof fallbackTaxBrackets; year: number; money: (value: number, decimals?: number) => string }) {
  const rows = Array.from({ length: 12 }, (_, index) => {
    const currentMonth = index + 1
    const inactive = currentMonth < startMonth
    const salary = salaries[index] || 0
    const item = calculateMonthFromSeries(salaries, currentMonth, startMonth, deduction, insuranceByMonth[currentMonth - 1] || insurance, { taxBrackets, insuranceByMonth })
    return { currentMonth, inactive, salary, item }
  })
  const activeRows = rows.filter((row) => !row.inactive)
  const annualTaxTotal = activeRows.reduce((sum, row) => sum + row.item.currentTax, 0)
  const maxTax = Math.max(1, ...activeRows.map((row) => row.item.currentTax))
  const peakTaxRow = activeRows.reduce<(typeof activeRows)[number] | null>((peak, row) => !peak || row.item.currentTax > peak.item.currentTax ? row : peak, null)
  const firstRate = activeRows[0]?.item.bracket.rate ?? 0
  const firstRateStep = activeRows.find((row) => row.item.bracket.rate > firstRate)
  const rateStepText = firstRateStep ? `${firstRateStep.currentMonth} 月进入 ${Math.round(firstRateStep.item.bracket.rate * 100)}% 档` : '全年未跨档'
  const exportCsv = () => {
    const header = ['月份', '税前收入', '到手工资', '个人五险一金', '累计应纳税所得额', '预扣率', '本月个税']
    const csvRows = [header, ...rows.map(({ currentMonth, inactive, salary, item }) => [
      `${currentMonth} 月`,
      inactive ? '' : Math.round(salary),
      inactive ? '' : Math.round(item.takeHome),
      inactive ? '' : Math.round(item.employeeInsurance),
      inactive ? '' : Math.round(item.taxable),
      inactive ? '' : `${Math.round(item.bracket.rate * 100)}%`,
      inactive ? '' : Math.round(item.currentTax),
    ])]
    trackEvent('export_csv', { calculator: 'salary', rows: rows.length })
    downloadCsv(`工资薪金逐月明细-${year}.csv`, csvRows)
  }

  const columns = [{ key: 'month', header: '月份' }, { key: 'income', header: '到手 / 税前' }, { key: 'insurance', header: '个人五险一金' }, { key: 'taxable', header: '累计应纳税所得额' }, { key: 'rate', header: '预扣率' }, { key: 'tax', header: '本月个税' }]
  const tableRows = rows.map(({ currentMonth, inactive, salary, item }) => ({
    key: currentMonth,
    tone: currentMonth === month ? 'highlight' as const : undefined,
    cells: {
      month: `${currentMonth} 月`,
      income: <><span className="take-home-value">{inactive ? '-' : money(item.takeHome, 0)}</span>{!inactive && <span className="before-tax-value">税前 {money(salary, 0)}</span>}</>,
      insurance: inactive ? '-' : money(item.employeeInsurance, 0),
      taxable: inactive ? '-' : money(item.taxable, 0),
      rate: inactive ? '-' : `${Math.round(item.bracket.rate * 100)}%`,
      tax: inactive ? '-' : money(item.currentTax, 0),
    },
  }))

  return <Panel as="section" className="annual-panel"><div className="section-heading-row"><h2>全年预扣逐月明细</h2><div className="annual-heading-actions"><span className="subtle-label">当前月份会高亮显示</span><button className={styles.exportButton} type="button" onClick={exportCsv}><Download size={14} />导出 CSV</button></div></div><div className="annual-summary-card"><div className="annual-chart-summary"><div><span>全年预扣合计</span><strong>{money(annualTaxTotal, 0)}</strong></div><div><span>最高月个税</span><strong>{peakTaxRow ? `${peakTaxRow.currentMonth} 月 ${money(peakTaxRow.item.currentTax, 0)}` : '-'}</strong></div><div><span>税率变化</span><strong>{rateStepText}</strong></div></div></div><div className="annual-tax-chart" aria-label="全年个税走势"><div className="annual-tax-bars">{rows.map(({ currentMonth, inactive, item }) => {
    const height = inactive ? 0 : Math.max(6, item.currentTax / maxTax * 100)
    const style = { '--tax-height': `${height}%` } as CSSProperties
    return <div className={`annual-tax-bar ${currentMonth === month ? 'current' : ''} ${inactive ? 'inactive' : ''}`} key={currentMonth}><span className="bar-value">{inactive ? '-' : money(item.currentTax, 0)}</span><span className="bar-track"><span className="bar-fill" style={style} /></span><span className="bar-month">{currentMonth}月</span></div>
  })}</div></div><DataTable ariaLabel="全年预扣逐月明细" columns={columns} rows={tableRows} wrapperClassName="annual-table-wrap" tableClassName="annual-table" /><p className="table-note">这里的全年个税为工资薪金累计预扣合计估算，不等同于年度汇算最终应纳或应退结果。</p></Panel>
}

function RateTable({ brackets, year, money }: { brackets: typeof fallbackTaxBrackets; year: number; money: (value: number, decimals?: number) => string }) {
  const columns = [
    { key: 'level', header: '级数', align: 'left' as const },
    { key: 'range', header: '累计预扣预缴应纳税所得额', align: 'left' as const },
    { key: 'rate', header: '预扣率', align: 'right' as const },
    { key: 'quick', header: '速算扣除数', align: 'right' as const },
  ]
  const rows = brackets.map((item, index) => ({
    key: item.rate,
    cells: {
      level: index + 1,
      range: item.rangeLabel || rateRanges[index] || '按规则区间',
      rate: { content: `${Math.round(item.rate * 100)}%`, tone: 'strong' as const },
      quick: { content: money(item.quick, 0).replace('¥', ''), tone: 'strong' as const },
    },
  }))

  return <section className="content-section" id="tax-rate-table"><div className="content-heading"><h2>{year} 年个人所得税预扣率表</h2></div><Panel className={styles.rateTablePanel}><DataTable ariaLabel={`${year} 年个人所得税预扣率表`} columns={columns} rows={rows} headerTone="muted" wrapperClassName={styles.rateTableWrap} tableClassName={styles.rateTable} /><div className={styles.sourceLine}>本表用于工资薪金累计预扣预缴，不适用于所有所得类型。<a href="https://12366.chinatax.gov.cn/bzds/pdfview/pdf/068-3-1.pdf" target="_blank" rel="noreferrer">查看 12366 来源 →</a></div></Panel></section>
}

function Faq() {
  const items = [['为什么我的工资一样，每个月个税不一样？', '工资薪金通常采用累计预扣法。累计收入、累计扣除和已预扣税额会随着月份变化，因此本月税额不一定固定。'], ['社保缴费基数可以和工资不一样吗？', '可以。不同城市和单位可能有不同的申报基数，但通常需要在对应城市政策允许范围内。计算器支持查看范围并手动填写。'], ['公积金比例可以自己选择吗？', '原型支持个人和单位分别选择 3% 至 12%。正式结果还要结合城市规则和单位实际缴纳方式。'], ['全年个税和年度汇算应纳税额是一回事吗？', '不是。页面中的全年个税默认指全年预扣合计估算，年度汇算最终结果还会受到全年综合所得、专项扣除和其他收入等因素影响。'], ['计算结果和工资条不一致怎么办？', '请检查城市、入职月份、社保公积金基数、比例、奖金和专项附加扣除。计算器只提供测算，最终以扣缴单位和税务机关口径为准。']]
  return <section className="content-section faq-section" id="faq"><div className="content-heading stacked-heading"><h2>税务知识与常见问题</h2><p>围绕累计预扣、社保公积金、专项扣除和年度汇算，集中回答常见问题。</p></div><div className="faq-list">{items.map(([question, answer], index) => <details open={index === 0} key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
}
