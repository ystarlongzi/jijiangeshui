'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Copy, Download } from 'lucide-react'
import { cityRules, housingRateOptions, taxBrackets } from '@/lib/tax-rules'
import { calculateInsurance, calculateMonthFromSeries, clamp, type InsuranceItem } from '@/lib/tax-calculator'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { specialDeductionItems } from '@/lib/special-deductions'
import { parseAmountParam, parseIntegerParam } from '@/lib/url-params'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import { Button } from '../Button'
import Toast from '../Toast'
import FormField from '../FormField'
import MoneyInput from '../MoneyInput'
import SelectField from '../SelectField'
import { useMoneyFormat } from '../MoneyFormatProvider'
import SpecialDeductionSelector from '../SpecialDeductionSelector'
import RuleSourcePanel from '../RuleSourcePanel'
import DataTable from '../DataTable'
import ValidationPanel from '../ValidationPanel'
import ResultActions, { ResultActionButton } from '../ResultActions/ResultActions'
import { trackEvent } from '../analytics'
import { downloadCsv } from '../csv'
import styles from './CalculatorClient.module.css'

const rateRanges = ['不超过 36,000 元', '超过 36,000 元至 144,000 元', '超过 144,000 元至 300,000 元', '超过 300,000 元至 420,000 元', '超过 420,000 元至 660,000 元', '超过 660,000 元至 960,000 元', '超过 960,000 元']

export default function CalculatorClient() {
  const { money } = useMoneyFormat()
  const [city, setCity] = useState('beijing')
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

  const rule = cityRules[city]
  const deduction = deductionAmount
  const selectedDeductionItems = Object.values(deductionSelections).map((id) => specialDeductionItems.find((item) => item.id === id)).filter(Boolean)
  const activeSalary = salaryMode === 'fixed' ? salary : monthlySalaries[month - 1] || 0
  const salaryForBase = salaryMode === 'fixed' ? salary : activeSalary
  const salariesForCalculation = useMemo(() => salaryMode === 'fixed' ? Array.from({ length: 12 }, () => salary) : monthlySalaries, [salaryMode, salary, monthlySalaries])

  useEffect(() => {
    if (!editingSocial) setSocialBase(clamp(salaryForBase, rule.socialMin, rule.socialMax))
    if (!editingHousing) setHousingBase(clamp(salaryForBase, rule.housingMin, rule.housingMax))
  }, [city, salaryForBase, rule, editingSocial, editingHousing])

  const insurance = useMemo(() => calculateInsurance(rule, socialBase, housingBase, employeeHousingRate, employerHousingRate), [rule, socialBase, housingBase, employeeHousingRate, employerHousingRate])
  const result = useMemo(() => calculateMonthFromSeries(salariesForCalculation, month, startMonth, deduction, insurance), [salariesForCalculation, month, startMonth, deduction, insurance])
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
  const ladderPosition = Math.max(0, taxBrackets.findIndex((item) => item.rate === result.bracket.rate)) / (taxBrackets.length - 1) * 100
  const isSalaryInvalid = activeSalary <= 0
  const isMonthInvalid = month < startMonth
  const isSocialBaseInvalid = socialBase < rule.socialMin || socialBase > rule.socialMax
  const isHousingBaseInvalid = housingBase < rule.housingMin || housingBase > rule.housingMax
  const isDeductionInvalid = deductionAmount > activeSalary
  const validationMessages = [
    isSalaryInvalid ? '税前月薪需要大于 0，才能计算工资到手和个人所得税。' : '',
    isMonthInvalid ? '计算月份不能早于入职月份，请调整月份后再查看结果。' : '',
    isSocialBaseInvalid ? `社保缴费基数需要在 ${wholeMoney(rule.socialMin)} - ${wholeMoney(rule.socialMax)} 之间。` : '',
    isHousingBaseInvalid ? `公积金缴费基数需要在 ${wholeMoney(rule.housingMin)} - ${wholeMoney(rule.housingMax)} 之间。` : '',
    isDeductionInvalid ? '专项附加扣除已超过税前月薪，请确认是否填入了月度扣除额。' : '',
  ].filter(Boolean)
  const hasValidationMessages = validationMessages.length > 0
  const flowWidth = (value: number) => `${Math.max(0, Math.min(100, value / flowTotal * 100))}%`

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedCity = params.get('city')
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
    if (requestedEmployeeHousingRate && housingRateOptions.includes(requestedEmployeeHousingRate)) setEmployeeHousingRate(requestedEmployeeHousingRate)
    if (requestedEmployerHousingRate && housingRateOptions.includes(requestedEmployerHousingRate)) setEmployerHousingRate(requestedEmployerHousingRate)
    if (requestedDeduction > 0) {
      setDeductionAmount(requestedDeduction)
      setDeductionSelections({})
      notify(`已带入专项附加扣除 ${money(requestedDeduction)} / 月`)
    }
  }, [])

  const reset = () => {
    setCity('beijing'); setSalary(20000); setMonth(8); setStartMonth(1); setSocialBase(20000); setHousingBase(20000)
    setSalaryMode('fixed'); setMonthlySalaries(Array.from({ length: 12 }, () => 20000)); setEditingSocial(false); setEditingHousing(false); setEmployeeHousingRate(12); setEmployerHousingRate(12); setDeductionAmount(0); setDeductionSelections({}); setDeductionDialogOpen(false); setCalculationOpen(false)
    notify('已恢复城市默认设置')
  }

  const locate = () => {
    if (!navigator.geolocation) return notify('当前浏览器不支持自动定位，请手动选择城市')
    notify('正在获取位置，请允许浏览器访问定位权限')
    navigator.geolocation.getCurrentPosition(() => notify('已获取位置，正式版将匹配对应城市规则'), () => notify('暂时无法获取位置，请手动选择城市'))
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
    trackEvent('calculate_complete', { calculator: 'salary', city, month, salaryMode, hasValidationMessages })
    notify(hasValidationMessages ? '请先修正输入提示' : '已更新计算结果')
  }
  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/calculator'
    url.hash = 'calculator'
    url.search = new URLSearchParams({
      city,
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
      `工资薪金测算：${rule.label} · ${currentYear} 年 ${month} 月`,
      `税前收入：${money(activeSalary, 2)}`,
      `到手工资：${money(result.takeHome, 2)}`,
      `本月个税：${money(result.currentTax, 2)}`,
      `个人社保：${money(socialEmployee, 2)}`,
      `个人公积金：${money(housingEmployee, 2)}`,
      `单位社保：${money(socialEmployer, 2)}`,
      `单位公积金：${money(housingEmployer, 2)}`,
      `累计应纳税所得额：${money(result.taxable, 2)}`,
      `适用预扣率：${rate}%`,
      `规则核对日期：${ruleCheckedDate}`,
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
  const formatTaxMessage = hasValidationMessages ? '当前输入存在需要确认的地方，先修正提示项后再查看计算结果。' : result.taxable <= 0 ? '累计扣除后应纳税所得额未超过 0，本月暂不需要预扣个税。' : rate > 3 ? `你在 ${month} 月累计应纳税所得额进入 ${rate}% 档位，所以本月个税比上月增加。` : '当前累计应纳税所得额仍在 3% 预扣率档位，个税随累计收入平稳变化。'

  return <div className="app-shell">
    <SiteHeader active="calculator" />

    <main id="top" className={styles.pageContent}>
      <section className="page-intro" id="calculator"><div><p className="eyebrow">工资薪金 · {currentYear}</p><h1>先看懂，再算清。</h1><p className="intro-copy">选择缴费城市，输入工资和必要扣除，看到本月到手与全年预扣明细。</p></div><div className="rule-date"><span className="status-dot" /><span>规则核对日期</span><strong>{ruleCheckedDate}</strong></div></section>

      <section className="workspace-grid" aria-label="个税计算器">
        <form className="input-panel panel" onSubmit={(event) => { event.preventDefault(); calculate() }}>
          <div className="panel-heading"><h2>计算条件</h2></div>
          <SelectField id="city" label="缴费城市" value={city} onChange={setCity} options={Object.entries(cityRules).map(([key, item]) => ({ value: key, label: item.label }))} action={<span className="city-actions"><Button variant="text" type="button" onClick={locate}>自动定位</Button><Button variant="text" type="button" onClick={() => notify('城市规则详情将在规则页展示')}>查看规则</Button></span>} />
          <FormField htmlFor="salary" label={salaryMode === 'fixed' ? '税前月薪' : `${month} 月税前收入`} error={isSalaryInvalid ? '税前收入需要大于 0。' : ''} action={<span className={styles.salaryModeRow}><Button className={styles.salaryModeButton} variant="text" type="button" aria-pressed={salaryMode === 'fixed'} onClick={() => switchSalaryMode('fixed')}>固定月薪</Button><Button className={styles.salaryModeButton} variant="text" type="button" aria-pressed={salaryMode === 'monthly'} onClick={() => switchSalaryMode('monthly')}>逐月填写</Button></span>}><MoneyInput id="salary" className={isSalaryInvalid ? 'input-error' : ''} value={activeSalary} onChange={updateActiveSalary} />{salaryMode === 'monthly' && <div className="monthly-salary-grid" aria-label="逐月税前收入">{monthlySalaries.map((value, index) => <label className={index + 1 === month ? 'current' : ''} key={index + 1}><span>{index + 1} 月</span><MoneyInput value={value} onChange={(next) => updateMonthlySalary(index + 1, next)} /></label>)}</div>}</FormField>
          <div className={styles.fieldGrid}><SelectField className={styles.compactField} id="month" label="计算月份" value={month} onChange={setMonth} invalid={isMonthInvalid} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /><SelectField className={styles.compactField} id="startMonth" label="入职月份" value={startMonth} onChange={setStartMonth} invalid={isMonthInvalid} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /></div>
          {isMonthInvalid && <p className={styles.fieldError}>计算月份不能早于入职月份。</p>}
          <div className={styles.sectionDivider} />
          <div className="panel-heading compact-heading"><h3>缴费基数与比例</h3></div>
          <div className="base-editor">
            <BaseField label="社保缴费基数" value={socialBase} min={rule.socialMin} max={rule.socialMax} invalid={isSocialBaseInvalid} editing={editingSocial} onEdit={() => setEditingSocial(!editingSocial)} onChange={setSocialBase} />
            <BaseField label="公积金缴费基数" value={housingBase} min={rule.housingMin} max={rule.housingMax} invalid={isHousingBaseInvalid} editing={editingHousing} onEdit={() => setEditingHousing(!editingHousing)} onChange={setHousingBase} />
          </div>
          <div className={styles.ratioGrid}><RateSelect label="公积金个人比例" value={employeeHousingRate} onChange={setEmployeeHousingRate} /><RateSelect label="公积金单位比例" value={employerHousingRate} onChange={setEmployerHousingRate} /></div><p className={styles.fieldMeta}>比例可选范围：3% - 12%，最终以城市规则和单位实际缴纳情况为准。</p>
          <FormField className={styles.deductionBlock} htmlFor="deductionAmount" label="专项附加扣除" action={<Button variant="text" type="button" onClick={() => setDeductionDialogOpen(true)}>选择项目</Button>} meta={selectedDeductionItems.length > 0 ? `已选择 ${selectedDeductionItems.map((item) => item?.label).join('、')}。` : '可直接输入本月扣除总额，也可以按项目选择后自动回填。'} error={isDeductionInvalid ? '这里填写的是本月扣除额，不能高于税前月薪。' : ''}><MoneyInput id="deductionAmount" className={isDeductionInvalid ? 'input-error' : ''} value={deductionAmount} onChange={(value) => { setDeductionAmount(value); setDeductionSelections({}) }} /></FormField>
          <ValidationPanel messages={validationMessages} title="请确认输入" />
          <div className={styles.formActions}><Button variant="primary" type="submit">开始计算</Button><Button variant="secondary" type="button" onClick={reset}>清空</Button></div><p className={styles.formFootnote}>结果仅供测算，最终以个税 APP、扣缴单位或税务机关口径为准。</p>
        </form>

        <div className="results-column">
          <section className="result-panel panel" aria-live="polite"><div className="result-topline"><span className="result-context">{rule.label} · {currentYear} 年 {month} 月</span><span className="result-badge">累计预扣</span></div><div className="take-home-block"><span>到手工资</span><strong>{money(result.takeHome, 2)}</strong><small>税前 <b>{wholeMoney(activeSalary)}</b></small></div>
            <div className="wage-flow"><div className="wage-flow-heading"><strong>本月工资流向</strong><span>到手 {takeHomePercent}%</span></div><div className="flow-bar" aria-hidden="true"><span className="flow-segment flow-take-home" style={{ width: flowWidth(result.takeHome) }} /><span className="flow-segment flow-social" style={{ width: flowWidth(socialEmployee) }} /><span className="flow-segment flow-housing" style={{ width: flowWidth(housingEmployee) }} /><span className="flow-segment flow-tax" style={{ width: flowWidth(result.currentTax) }} /></div><div className="flow-legend"><FlowLegend className="flow-take-home-dot" label="到手工资" value={result.takeHome} money={money} /><FlowLegend className="flow-social-dot" label="个人社保" value={socialEmployee} money={money} /><FlowLegend className="flow-housing-dot" label="公积金" value={housingEmployee} money={money} /><FlowLegend className="flow-tax-dot" label="个人所得税" value={result.currentTax} money={money} /></div></div>
            <div className="result-explanation">{formatTaxMessage}</div><div className="tax-ladder"><div className="tax-ladder-heading"><span>当前预扣率档位</span><strong>{rate}% 档</strong></div><div className="tax-ladder-rail"><span className="tax-ladder-progress" style={{ width: `${ladderPosition}%` }} /><span className="tax-ladder-marker" style={{ left: `${ladderPosition}%` }} /></div><div className="tax-ladder-levels">{[3, 10, 20, 25, 30, 35, 45].map((item) => <span key={item} className={item === rate ? 'active' : ''}>{item}%</span>)}</div></div><ResultActions><ResultActionButton onClick={() => { const next = !calculationOpen; setCalculationOpen(next); trackEvent('result_expand', { calculator: 'salary', expanded: next }) }}>查看计算过程 <span>→</span></ResultActionButton><ResultActionButton onClick={copyPayslip}><Copy size={14} />复制工资条</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions>{calculationOpen && <div className="calculation-detail"><div><span>累计应纳税所得额</span><strong>{wholeMoney(result.taxable)}</strong></div><div><span>预扣率 × 应纳税所得额</span><strong>{rate}% × {wholeMoney(result.taxable)}</strong></div><div><span>速算扣除数</span><strong>{wholeMoney(result.bracket.quick)}</strong></div></div>}</section>
          <InsuranceTable insurance={insurance} month={month} money={money} />
        </div>
      </section>

      <AnnualTable salaries={salariesForCalculation} month={month} startMonth={startMonth} deduction={deduction} insurance={insurance} money={money} />
      <RateTable money={money} />
      <Faq />
      <RuleSourcePanel
        title="每个结果都有出处"
        description="计算口径参考国家税务总局及 12366 公开规则，政策变化后会更新规则版本和核对日期。"
        links={[
          { label: '累计预扣法说明', url: 'https://www.chinatax.gov.cn/chinatax/n810341/n810760/c3959585/content.html' },
          { label: '专项附加扣除标准', url: 'https://fgk.chinatax.gov.cn/zcfgk/c100012/c5213592/content.html' },
        ]}
      />
      <SiteFooter />
    </main>
    <SpecialDeductionSelector
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

function RateSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <SelectField className={styles.compactField} label={label} value={value} onChange={onChange} options={housingRateOptions.map((rate) => ({ value: rate, label: `${rate}%` }))} />
}

function FlowLegend({ className, label, value, money }: { className: string; label: string; value: number; money: (value: number, decimals?: number) => string }) {
  return <div><span className={`flow-dot ${className}`} /><span>{label}</span><strong>{money(value, 0)}</strong></div>
}

function ContributionSegment({ className, label, value, total, money }: { className: string; label: string; value: number; total: number; money: (value: number, decimals?: number) => string }) {
  const percent = total > 0 ? value / total * 100 : 0
  return <div className="contribution-item"><span className={`contribution-dot ${className}`} /><span>{label}</span><strong>{money(value, 0)}</strong><em>{Math.round(percent)}%</em></div>
}

function InsuranceTable({ insurance, month, money }: { insurance: InsuranceItem[]; month: number; money: (value: number, decimals?: number) => string }) {
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
    { key: 'social-total', className: 'subtotal social-subtotal', cells: { name: '社保合计', employee: money(sum(social, 'employee'), 2), employer: money(sum(social, 'employer'), 2), subtotal: money(sum(social, 'subtotal'), 2) } },
    ...housing.map((item) => ({
      key: item.name,
      className: 'housing-row',
      cells: { name: item.name, employee: amountWithFormula(item.employee, item.employeeFormula), employer: amountWithFormula(item.employer, item.employerFormula), subtotal: money(item.subtotal, 2) },
    })),
    { key: 'insurance-total', className: 'subtotal total-subtotal', cells: { name: '社保、公积金合计', employee: money(sum(insurance, 'employee'), 2), employer: money(sum(insurance, 'employer'), 2), subtotal: money(sum(insurance, 'subtotal'), 2) } },
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
    downloadCsv(`五险一金汇缴明细-${currentYear}-${month}月.csv`, rows)
  }

  return <section className="detail-panel panel"><div className="section-heading-row"><div className="heading-with-meta"><h2>五险一金汇缴明细</h2><span className="month-label">{currentYear} 年 {month} 月</span></div><button className={styles.exportButton} type="button" onClick={exportCsv}><Download size={14} />导出 CSV</button></div><div className="contribution-chart" aria-label="社保公积金缴费占比"><div className="contribution-total"><span>本月汇缴总额</span><strong>{money(contributionTotal, 0)}</strong></div><div className="contribution-stack">{contributionSegments.map((item) => <span className={`contribution-segment ${item.className}`} style={{ '--segment-width': `${contributionTotal > 0 ? item.value / contributionTotal * 100 : 0}%` } as CSSProperties} key={item.label} title={`${item.label} ${money(item.value, 0)}`} />)}</div><div className="contribution-list">{contributionSegments.map((item) => <ContributionSegment key={item.label} {...item} total={contributionTotal} money={money} />)}</div></div><DataTable columns={columns} rows={tableRows} wrapperClassName="detail-table-wrap" tableClassName="insurance-table" /><p className="table-note">金额下方展示实际使用的缴费基数 × 比例，便于核对规则。</p></section>
}

function AnnualTable({ salaries, month, startMonth, deduction, insurance, money }: { salaries: number[]; month: number; startMonth: number; deduction: number; insurance: InsuranceItem[]; money: (value: number, decimals?: number) => string }) {
  const rows = Array.from({ length: 12 }, (_, index) => {
    const currentMonth = index + 1
    const inactive = currentMonth < startMonth
    const salary = salaries[index] || 0
    const item = calculateMonthFromSeries(salaries, currentMonth, startMonth, deduction, insurance)
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
    downloadCsv(`工资薪金逐月明细-${currentYear}.csv`, csvRows)
  }

  const columns = [{ key: 'month', header: '月份' }, { key: 'income', header: '到手 / 税前' }, { key: 'insurance', header: '个人五险一金' }, { key: 'taxable', header: '累计应纳税所得额' }, { key: 'rate', header: '预扣率' }, { key: 'tax', header: '本月个税' }]
  const tableRows = rows.map(({ currentMonth, inactive, salary, item }) => ({
    key: currentMonth,
    className: currentMonth === month ? 'current-month' : '',
    cells: {
      month: `${currentMonth} 月`,
      income: <><span className="take-home-value">{inactive ? '-' : money(item.takeHome, 0)}</span>{!inactive && <span className="before-tax-value">税前 {money(salary, 0)}</span>}</>,
      insurance: inactive ? '-' : money(item.employeeInsurance, 0),
      taxable: inactive ? '-' : money(item.taxable, 0),
      rate: inactive ? '-' : `${Math.round(item.bracket.rate * 100)}%`,
      tax: inactive ? '-' : money(item.currentTax, 0),
    },
  }))

  return <section className="annual-panel panel"><div className="section-heading-row"><h2>全年预扣逐月明细</h2><div className="annual-heading-actions"><span className="subtle-label">当前月份会高亮显示</span><button className={styles.exportButton} type="button" onClick={exportCsv}><Download size={14} />导出 CSV</button></div></div><div className="annual-summary-card"><div className="annual-chart-summary"><div><span>全年预扣合计</span><strong>{money(annualTaxTotal, 0)}</strong></div><div><span>最高月个税</span><strong>{peakTaxRow ? `${peakTaxRow.currentMonth} 月 ${money(peakTaxRow.item.currentTax, 0)}` : '-'}</strong></div><div><span>税率变化</span><strong>{rateStepText}</strong></div></div></div><div className="annual-tax-chart" aria-label="全年个税走势"><div className="annual-tax-bars">{rows.map(({ currentMonth, inactive, item }) => {
    const height = inactive ? 0 : Math.max(6, item.currentTax / maxTax * 100)
    const style = { '--tax-height': `${height}%` } as CSSProperties
    return <div className={`annual-tax-bar ${currentMonth === month ? 'current' : ''} ${inactive ? 'inactive' : ''}`} key={currentMonth}><span className="bar-value">{inactive ? '-' : money(item.currentTax, 0)}</span><span className="bar-track"><span className="bar-fill" style={style} /></span><span className="bar-month">{currentMonth}月</span></div>
  })}</div></div><DataTable columns={columns} rows={tableRows} wrapperClassName="annual-table-wrap" tableClassName="annual-table" /><p className="table-note">这里的全年个税为工资薪金累计预扣合计估算，不等同于年度汇算最终应纳或应退结果。</p></section>
}

function RateTable({ money }: { money: (value: number, decimals?: number) => string }) {
  const columns = [
    { key: 'level', header: '级数' },
    { key: 'range', header: '累计预扣预缴应纳税所得额' },
    { key: 'rate', header: '预扣率', className: styles.alignRight },
    { key: 'quick', header: '速算扣除数', className: styles.alignRight },
  ]
  const rows = taxBrackets.map((item, index) => ({
    key: item.rate,
    cells: {
      level: index + 1,
      range: rateRanges[index],
      rate: `${Math.round(item.rate * 100)}%`,
      quick: money(item.quick, 0).replace('¥', ''),
    },
  }))

  return <section className="content-section" id="tax-rate-table"><div className="content-heading"><h2>个人所得税预扣率表</h2></div><div className={`${styles.rateTablePanel} panel`}><DataTable columns={columns} rows={rows} wrapperClassName={styles.rateTableWrap} tableClassName={styles.rateTable} /><div className={styles.sourceLine}>本表用于工资薪金累计预扣预缴，不适用于所有所得类型。<a href="https://12366.chinatax.gov.cn/bzds/pdfview/pdf/068-3-1.pdf" target="_blank" rel="noreferrer">查看 12366 来源 →</a></div></div></section>
}

function Faq() {
  const items = [['为什么我的工资一样，每个月个税不一样？', '工资薪金通常采用累计预扣法。累计收入、累计扣除和已预扣税额会随着月份变化，因此本月税额不一定固定。'], ['社保缴费基数可以和工资不一样吗？', '可以。不同城市和单位可能有不同的申报基数，但通常需要在对应城市政策允许范围内。计算器支持查看范围并手动填写。'], ['公积金比例可以自己选择吗？', '原型支持个人和单位分别选择 3% 至 12%。正式结果还要结合城市规则和单位实际缴纳方式。'], ['全年个税和年度汇算应纳税额是一回事吗？', '不是。页面中的全年个税默认指全年预扣合计估算，年度汇算最终结果还会受到全年综合所得、专项扣除和其他收入等因素影响。'], ['计算结果和工资条不一致怎么办？', '请检查城市、入职月份、社保公积金基数、比例、奖金和专项附加扣除。计算器只提供测算，最终以扣缴单位和税务机关口径为准。']]
  return <section className="content-section faq-section" id="faq"><div className="content-heading stacked-heading"><h2>税务知识与常见问题</h2><p>围绕累计预扣、社保公积金、专项扣除和年度汇算，集中回答常见问题。</p></div><div className="faq-list">{items.map(([question, answer], index) => <details open={index === 0} key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
}
