'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Copy, LocateFixed, RotateCcw } from 'lucide-react'
import SiteHeader from '../../_components/SiteHeader'
import SiteFooter from '../../_components/SiteFooter'
import { Button } from '../../_components/Button'
import Toast from '../../_components/Toast'
import FormField from '../../_components/FormField'
import MoneyInput from '../../_components/MoneyInput'
import Panel from '../../_components/Panel'
import ProcessTable from '../../_components/ProcessTable'
import SelectField from '../../_components/SelectField'
import CitySelect from '../../_components/CitySelect'
import TrackedLink from '../../_components/TrackedLink'
import { useMoneyFormat } from '../../_components/MoneyFormatProvider'
import MetricGrid from '../../_components/MetricGrid'
import ValidationPanel from '../../_components/ValidationPanel'
import RuleBoundaryNotice from '../../_components/RuleBoundaryNotice'
import styles from './ReverseTaxClient.module.css'
import SpecialDeductionSelector from '../special-deductions/SpecialDeductionSelector'
import ResultActions, { ResultActionButton, ResultActionLink } from '../../_components/ResultActions/ResultActions'
import useCityLocator from '../../_hooks/useCityLocator'
import { formatDateOnly } from '../../_lib/date'
import { calculateReverseTax } from '@/lib/reverse-tax'
import { auditCityRule, getRuleQualityStatus } from '@/lib/city-rule-quality'
import { getValidatedHousingRateOptions, validateHousingRateInputs } from '@/lib/city-rule-validation'
import { currentYear } from '@/lib/site'
import { cityRules as fallbackCityRules, getCityRuleForMonth, getCityRuleForMonthStrict, resolveCityRuleForMonth, type CityRule } from '@/lib/tax-rules'
import { specialDeductionGroups as fallbackDeductionGroups, specialDeductionItems as fallbackDeductionItems } from '@/lib/special-deductions'
import type { IncomeTaxRuleDataset, IncomeTaxYearRules } from '@/lib/income-tax-rule-types'
import { parseAmountParam, parseIntegerParam } from '@/lib/url-params'

type ReverseTaxClientProps = {
  rules?: Record<string, CityRule>
  incomeTaxRules?: IncomeTaxRuleDataset
  cityRuleStatus?: {
    source: 'payload' | 'fallback'
    ruleSourcesByCity: Record<string, 'payload' | 'fallback'>
    fallbackReason?: string
  }
}

export default function ReverseTaxClient({ rules = fallbackCityRules, incomeTaxRules, cityRuleStatus }: ReverseTaxClientProps) {
  const { money } = useMoneyFormat()
  const cityRules = rules
  const [targetTakeHome, setTargetTakeHome] = useState(15000)
  const [city, setCity] = useState('beijing')
  const [taxYear, setTaxYear] = useState(incomeTaxRules?.availableYears[0] || currentYear)
  const [month, setMonth] = useState(8)
  const [startMonth, setStartMonth] = useState(1)
  const [employeeHousingRate, setEmployeeHousingRate] = useState(12)
  const [employerHousingRate, setEmployerHousingRate] = useState(12)
  const [deductionAmount, setDeductionAmount] = useState(0)
  const [deductions, setDeductions] = useState<Record<string, string>>({})
  const [deductionDialogOpen, setDeductionDialogOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedCity = params.get('city')
    const requestedYear = parseIntegerParam(params.get('year'), 2000, 2100)
    const requestedTarget = parseAmountParam(params.get('target'))
    const requestedDeduction = parseAmountParam(params.get('deduction'))
    const requestedMonth = parseIntegerParam(params.get('month'), 1, 12)
    const requestedStartMonth = parseIntegerParam(params.get('startMonth'), 1, 12)
    const requestedEmployeeHousingRate = parseIntegerParam(params.get('employeeHousingRate'), 3, 12)
    const requestedEmployerHousingRate = parseIntegerParam(params.get('employerHousingRate'), 3, 12)

    if (requestedCity && cityRules[requestedCity]) setCity(requestedCity)
    if (requestedYear && incomeTaxRules?.availableYears.includes(requestedYear)) setTaxYear(requestedYear)
    if (requestedTarget > 0) setTargetTakeHome(requestedTarget)
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
      setDeductions({})
      notify(`已带入专项附加扣除 ${money(requestedDeduction)} / 月`)
    }
    // 这里只在首次挂载时解析 URL，避免用户修改反推参数后又被 URL 覆盖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedCityRule = cityRules[city] || cityRules.beijing || fallbackCityRules.beijing
  const yearRules: IncomeTaxYearRules = incomeTaxRules?.rulesByYear[String(taxYear)] || {
    year: taxYear,
    taxBrackets: [],
    taxRates: [],
    specialDeductionGroups: fallbackDeductionGroups,
    specialDeductionItems: fallbackDeductionItems,
    taxRateAvailable: false,
    taxRateWarnings: [],
    specialDeductionAvailable: false,
    source: 'unavailable',
    missingReasons: [`${taxYear} 年税率和专项附加扣除规则尚未加载。`],
  }
  const cityRuleResolution = resolveCityRuleForMonth(selectedCityRule, taxYear, month)
  const rule = cityRuleResolution.rule
  const cityRuleLoaded = !cityRuleStatus || (cityRuleStatus.source === 'payload' && cityRuleStatus.ruleSourcesByCity[city] === 'payload')
  const ruleSourceDate = rule.sources.find((source) => source.checkedAt)?.checkedAt || rule.effective
  const displayRuleSourceDate = formatDateOnly(ruleSourceDate)
  const cityHousingRateOptions = useMemo(() => getValidatedHousingRateOptions(rule), [rule])
  const housingRateValidation = useMemo(() => validateHousingRateInputs(rule, employeeHousingRate, employerHousingRate), [rule, employeeHousingRate, employerHousingRate])
  const ruleQualityIssues = useMemo(() => auditCityRule(city, rule), [city, rule])
  const hasRuleQualityErrors = getRuleQualityStatus(ruleQualityIssues) === 'error'
  const isTargetInvalid = targetTakeHome <= 0
  const isMonthInvalid = month < startMonth
  const housingRateOptionsText = cityHousingRateOptions.map((rate) => `${rate}%`).join('、')
  const missingCityRuleMonths = useMemo(() => Array.from({ length: Math.max(0, month - startMonth + 1) }, (_, index) => startMonth + index)
    .filter((targetMonth) => !getCityRuleForMonthStrict(selectedCityRule, taxYear, targetMonth)), [selectedCityRule, taxYear, month, startMonth])
  const cityRuleFallbackMessage = missingCityRuleMonths.length > 0 || cityRuleResolution.usedFallback
    ? `${taxYear} 年${missingCityRuleMonths.length > 0 ? ` ${missingCityRuleMonths.join('、')} 月` : ` ${month} 月`}尚无单独的城市缴费规则，当前按 ${formatDateOnly(rule.effective)} 起的最近可用规则估算。`
    : ''
  const blockingRuleMessages = [
    !cityRuleLoaded ? `当前城市规则没有从 CMS 成功加载${cityRuleStatus?.fallbackReason ? `（${cityRuleStatus.fallbackReason}）` : ''}，暂时无法可靠反推。` : '',
    ...yearRules.missingReasons,
  ].filter(Boolean)
  const validationMessages = [
    cityRuleFallbackMessage,
    ...blockingRuleMessages,
    hasRuleQualityErrors ? `${rule.label} 当前规则信息不完整，暂时无法可靠反推，请稍后再试或查看城市规则。` : '',
    isTargetInvalid ? '期望到手工资需要大于 0，才能进行税前工资反推。' : '',
    isMonthInvalid ? '计算月份不能早于入职月份，请调整月份后再查看结果。' : '',
    !housingRateValidation.employeeHousingRate.valid ? cityHousingRateOptions.length > 0 ? `公积金个人比例需从 ${housingRateOptionsText} 中选择。` : '当前城市暂无可用的公积金缴费比例规则，暂时无法可靠反推。' : '',
    !housingRateValidation.employerHousingRate.valid ? cityHousingRateOptions.length > 0 ? `公积金单位比例需从 ${housingRateOptionsText} 中选择。` : '当前城市暂无可用的公积金缴费比例规则，暂时无法可靠反推。' : '',
  ].filter(Boolean)
  const calculationBlocked = [
    ...blockingRuleMessages,
    hasRuleQualityErrors ? `${rule.label} 当前规则信息不完整，暂时无法可靠反推，请稍后再试或查看城市规则。` : '',
    isTargetInvalid ? '期望到手工资需要大于 0。' : '',
    isMonthInvalid ? '计算月份不能早于入职月份。' : '',
    !housingRateValidation.employeeHousingRate.valid ? '公积金个人比例不在当前城市规则范围内。' : '',
    !housingRateValidation.employerHousingRate.valid ? '公积金单位比例不在当前城市规则范围内。' : '',
  ].filter(Boolean).length > 0
  const selectedDeductionItems = Object.values(deductions).map((id) => yearRules.specialDeductionItems.find((item) => item.id === id)).filter(Boolean)
  const result = useMemo(() => calculateReverseTax({ targetTakeHome, rule, month, startMonth, deduction: deductionAmount, employeeHousingRate, employerHousingRate, taxBrackets: yearRules.taxBrackets }), [targetTakeHome, rule, month, startMonth, deductionAmount, employeeHousingRate, employerHousingRate, yearRules.taxBrackets])
  const employeeInsurance = result.insurance.reduce((sum, item) => sum + item.employee, 0)
  const rate = Math.round(result.result.bracket.rate * 100)
  const saveDeductions = (value: Record<string, string>, amount: number) => {
    setDeductions(value)
    setDeductionAmount(amount)
    setDeductionDialogOpen(false)
  }
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }
  const locate = useCityLocator(notify, { rules: cityRules, onLocated: setCity })

  useEffect(() => {
    if (cityHousingRateOptions.length === 0) return
    const fallbackRate = cityHousingRateOptions[cityHousingRateOptions.length - 1]
    setEmployeeHousingRate((current) => cityHousingRateOptions.includes(current) ? current : fallbackRate)
    setEmployerHousingRate((current) => cityHousingRateOptions.includes(current) ? current : fallbackRate)
  }, [cityHousingRateOptions])
  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/reverse-tax'
    url.search = new URLSearchParams({
      city,
      year: String(taxYear),
      target: String(Math.round(targetTakeHome)),
      month: String(month),
      startMonth: String(startMonth),
      employeeHousingRate: String(employeeHousingRate),
      employerHousingRate: String(employerHousingRate),
      deduction: String(Math.round(deductionAmount)),
    }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前反推链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }
  const copyResult = async () => {
    const lines = [
      `${taxYear} 年税后反推测算`,
      `缴费城市：${rule.label}`,
      `计算月份：${month} 月`,
      `入职月份：${startMonth} 月`,
      `规则核对日期：${displayRuleSourceDate}`,
      `期望到手工资：${money(targetTakeHome)}`,
      `专项附加扣除：${money(deductionAmount)} / 月`,
      '',
      `预计税前月薪：${money(result.salary)}`,
      `预计到手：${money(result.result.takeHome, 2)}`,
      `本月个税：${money(result.result.currentTax, 2)}`,
      `个人五险一金：${money(employeeInsurance, 2)}`,
      `适用预扣率：${rate}%`,
      `到手偏差：${money(result.gap, 2)}`,
      '',
      '结果仅供测算，最终以工资条、扣缴单位或税务机关口径为准。',
    ].join('\n')

    try {
      await navigator.clipboard.writeText(lines)
      notify('已复制税后反推结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动选择结果')
    }
  }
  const reset = () => { setTargetTakeHome(15000); setCity('beijing'); setTaxYear(incomeTaxRules?.availableYears[0] || currentYear); setMonth(8); setStartMonth(1); setEmployeeHousingRate(12); setEmployerHousingRate(12); setDeductionAmount(0); setDeductions({}); setDeductionDialogOpen(false) }

  return <>
  <div className="app-shell"><SiteHeader active="reverse-tax" /><main className={styles.page}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>{taxYear} 年税后反推计算器</p><h1>税后工资，反推税前。</h1><p>输入期望到手工资，结合城市缴费规则、专项扣除和累计预扣，估算需要的税前月薪。</p></div><div className={styles.heroCard}><span>反推结果会受月份影响</span><strong>{rule.label} · {taxYear} 年 {month} 月</strong><small>规则核对日期：{displayRuleSourceDate}</small></div></header>
    <section className={styles.workspace} aria-label="税后反推税前工资">
      <Panel as="form" className={styles.input} onSubmit={(event) => event.preventDefault()}>
        <h2>反推条件</h2>
        <label className={styles.field} htmlFor="targetTakeHome"><span>期望到手工资</span><MoneyInput id="targetTakeHome" className={isTargetInvalid ? 'input-error' : ''} value={targetTakeHome} onChange={setTargetTakeHome} /></label>
        <CitySelect id="reverseCity" label="缴费城市" value={city} onChange={setCity} rules={cityRules} invalid={hasRuleQualityErrors} action={<span className={styles.cityActions}><Button className={styles.textButton} variant="text" type="button" onClick={locate}><LocateFixed size={13} /> 自动定位</Button><TrackedLink className={styles.textButton} href={`/city/${city}`} eventPayload={{ module: 'reverse_tax_form', label: '查看城市规则', city }}>查看规则</TrackedLink></span>} />
        <div className={styles.fieldGrid}><SelectField className={styles.compactField} id="reverseTaxYear" label="纳税年度" value={taxYear} onChange={setTaxYear} options={(incomeTaxRules?.availableYears || [currentYear]).map((year) => ({ value: year, label: `${year} 年` }))} /><SelectField className={styles.compactField} id="reverseMonth" label="计算月份" value={month} onChange={setMonth} invalid={isMonthInvalid} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /><SelectField className={styles.compactField} id="reverseStartMonth" label="入职月份" value={startMonth} onChange={setStartMonth} invalid={isMonthInvalid} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /></div>
        <div className={styles.ratioGrid}><SelectField className={styles.compactField} id="employeeHousingRate" label="公积金个人比例" value={employeeHousingRate} invalid={!housingRateValidation.employeeHousingRate.valid} onChange={setEmployeeHousingRate} options={cityHousingRateOptions.map((rate) => ({ value: rate, label: `${rate}%` }))} /><SelectField className={styles.compactField} id="employerHousingRate" label="公积金单位比例" value={employerHousingRate} invalid={!housingRateValidation.employerHousingRate.valid} onChange={setEmployerHousingRate} options={cityHousingRateOptions.map((rate) => ({ value: rate, label: `${rate}%` }))} /></div>
        <FormField className={styles.deductions} htmlFor="reverseDeduction" label="专项附加扣除" action={<Button className={styles.textButton} variant="text" type="button" onClick={() => setDeductionDialogOpen(true)}>选择项目</Button>} meta={selectedDeductionItems.length > 0 ? `已选择 ${selectedDeductionItems.map((item) => item?.label).join('、')}，合计 ${money(deductionAmount)} / 月。` : '可直接输入本月专项附加扣除总额，也可以按项目选择后自动回填。'}><MoneyInput id="reverseDeduction" value={deductionAmount} onChange={(value) => { setDeductionAmount(value); setDeductions({}) }} /></FormField>
        <ValidationPanel messages={validationMessages} title="请确认输入" />
        <div className={styles.formActions}><Button variant="primary" type="submit">更新结果 <ArrowRight size={16} /></Button><Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button></div>
      </Panel>
      {calculationBlocked ? <Panel as="section" className={styles.result} aria-live="polite"><ValidationPanel messages={validationMessages} title="暂时无法反推" /><p className={styles.resultExplain}>规则未完成加载前，不展示一个看似精确的税前工资。请先补齐对应年度的 CMS 规则后再试。</p></Panel> : <Panel as="section" className={styles.result} aria-live="polite"><div className={styles.resultHeading}><div><span className={styles.sectionTitle}>反推结果</span><p>{rule.label} · {taxYear} 年 {month} 月</p></div><span className={styles.badge}>累计预扣</span></div><div className={styles.required}><span>预计税前月薪</span><strong>{money(result.salary)}</strong><p>若想本月到手约 {money(targetTakeHome)}，税前月薪需要约 {money(result.salary)}。</p></div><MetricGrid items={[{ label: '预计到手', value: money(result.result.takeHome, 2) }, { label: '本月个税', value: money(result.result.currentTax, 2) }, { label: '个人五险一金', value: money(employeeInsurance, 2) }, { label: '适用预扣率', value: `${rate}%` }]} />{cityRuleFallbackMessage && <RuleBoundaryNotice messages={[cityRuleFallbackMessage]} title="城市规则估算口径" />}<div className={styles.resultExplain}><h3>怎么反推出来？</h3><p>系统会尝试不同税前工资，并按 {rule.label} 社保公积金规则和累计预扣法计算到手工资，直到结果接近期望到手。</p><dl><div><dt>社保缴费基数</dt><dd>{money(result.socialBase)}</dd></div><div><dt>公积金缴费基数</dt><dd>{money(result.housingBase)}</dd></div><div><dt>到手偏差</dt><dd>{money(result.gap, 2)}</dd></div></dl></div><ResultActions><ResultActionLink href="/calculator">进入工资计算器 <span>→</span></ResultActionLink><ResultActionButton onClick={copyResult}><Copy size={14} />复制结果</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions></Panel>}
    </section>
    {!calculationBlocked && <ReverseProcess result={result} targetTakeHome={targetTakeHome} employeeInsurance={employeeInsurance} />}
    <section className={styles.explain}><div><h2>结果怎么使用？</h2><p>反推结果适合用于谈薪、核对 offer 和预算估算。实际工资条可能受到奖金、补发工资、单位缴费口径等因素影响。</p></div><a href="/calculator">进入工资薪金计算器 <ArrowRight size={15} /></a></section>
    <SiteFooter />
  </main></div>
  <SpecialDeductionSelector
    groups={yearRules.specialDeductionGroups}
    items={yearRules.specialDeductionItems}
    open={deductionDialogOpen}
    value={deductions}
    emptyText="大病医疗通常在年度汇算时按实际发生额扣除，暂不参与本月工资反推。"
    onClose={() => setDeductionDialogOpen(false)}
    onSave={saveDeductions}
  />
  <Toast message={toast} />
  </>
}

function ReverseProcess({ result, targetTakeHome, employeeInsurance }: { result: ReturnType<typeof calculateReverseTax>; targetTakeHome: number; employeeInsurance: number }) {
  const { money } = useMoneyFormat()
  const rate = Math.round(result.result.bracket.rate * 100)

  return <ProcessTable title="计算过程" description="先用二分法找到接近期望到手的税前工资，再套用工资薪金累计预扣法核算本月结果。" groups={[{ title: '反推条件', rows: [{ label: '期望到手', value: money(targetTakeHome) }, { label: '税前月薪', value: <>约 {money(result.salary)}</> }, { label: '社保缴费基数', value: money(result.socialBase) }, { label: '公积金缴费基数', value: money(result.housingBase) }] }, { title: '本月核算', rows: [{ label: '累计应纳税所得额', value: money(result.result.taxable) }, { label: '适用预扣率', value: `${rate}%` }, { label: '本月个税', value: money(result.result.currentTax, 2) }, { label: '到手工资', value: <>{money(result.salary)} - {money(employeeInsurance, 2)} - {money(result.result.currentTax, 2)} = {money(result.result.takeHome, 2)}</> }] }]} />
}
