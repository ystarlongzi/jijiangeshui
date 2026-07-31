'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Copy, LocateFixed, RotateCcw } from 'lucide-react'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import { Button } from '../Button'
import MoneyInput from '../MoneyInput'
import SelectField from '../SelectField'
import { useMoneyFormat } from '../MoneyFormatProvider'
import MetricGrid from '../MetricGrid'
import styles from './ReverseTaxClient.module.css'
import SpecialDeductionSelector from '../SpecialDeductionSelector'
import ResultActions, { ResultActionButton, ResultActionLink } from '../ResultActions/ResultActions'
import { calculateReverseTax } from '@/lib/reverse-tax'
import { currentYear } from '@/lib/site'
import { cityRules, housingRateOptions } from '@/lib/tax-rules'
import { specialDeductionItems } from '@/lib/special-deductions'
import { parseAmountParam, parseIntegerParam } from '@/lib/url-params'

export default function ReverseTaxClient() {
  const { money } = useMoneyFormat()
  const [targetTakeHome, setTargetTakeHome] = useState(15000)
  const [city, setCity] = useState('beijing')
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
    const requestedTarget = parseAmountParam(params.get('target'))
    const requestedDeduction = parseAmountParam(params.get('deduction'))
    const requestedMonth = parseIntegerParam(params.get('month'), 1, 12)
    const requestedStartMonth = parseIntegerParam(params.get('startMonth'), 1, 12)
    const requestedEmployeeHousingRate = parseIntegerParam(params.get('employeeHousingRate'), 3, 12)
    const requestedEmployerHousingRate = parseIntegerParam(params.get('employerHousingRate'), 3, 12)

    if (requestedCity && cityRules[requestedCity]) setCity(requestedCity)
    if (requestedTarget > 0) setTargetTakeHome(requestedTarget)
    if (requestedMonth) setMonth(requestedMonth)
    if (requestedStartMonth) setStartMonth(requestedStartMonth)
    if (requestedEmployeeHousingRate && housingRateOptions.includes(requestedEmployeeHousingRate)) setEmployeeHousingRate(requestedEmployeeHousingRate)
    if (requestedEmployerHousingRate && housingRateOptions.includes(requestedEmployerHousingRate)) setEmployerHousingRate(requestedEmployerHousingRate)
    if (requestedDeduction > 0) {
      setDeductionAmount(requestedDeduction)
      setDeductions({})
      notify(`已带入专项附加扣除 ${money(requestedDeduction)} / 月`)
    }
  }, [])

  const rule = cityRules[city]
  const selectedDeductionItems = Object.values(deductions).map((id) => specialDeductionItems.find((item) => item.id === id)).filter(Boolean)
  const result = useMemo(() => calculateReverseTax({ targetTakeHome, rule, month, startMonth, deduction: deductionAmount, employeeHousingRate, employerHousingRate }), [targetTakeHome, rule, month, startMonth, deductionAmount, employeeHousingRate, employerHousingRate])
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
  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/reverse-tax'
    url.search = new URLSearchParams({
      city,
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
      `${currentYear} 年税后反推测算`,
      `缴费城市：${rule.label}`,
      `计算月份：${month} 月`,
      `入职月份：${startMonth} 月`,
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
  const reset = () => { setTargetTakeHome(15000); setCity('beijing'); setMonth(8); setStartMonth(1); setEmployeeHousingRate(12); setEmployerHousingRate(12); setDeductionAmount(0); setDeductions({}); setDeductionDialogOpen(false) }

  return <>
  <div className="app-shell"><SiteHeader active="reverse-tax" /><main className={styles.page}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>{currentYear} 年税后反推计算器</p><h1>税后工资，反推税前。</h1><p>输入期望到手工资，结合城市缴费规则、专项扣除和累计预扣，估算需要的税前月薪。</p></div><div className={styles.heroCard}><span>反推结果会受月份影响</span><strong>{rule.label} · {currentYear} 年 {month} 月</strong></div></header>
    <section className={styles.workspace} aria-label="税后反推税前工资">
      <form className={`${styles.input} panel`} onSubmit={(event) => event.preventDefault()}>
        <h2>反推条件</h2>
        <label className={styles.field} htmlFor="targetTakeHome"><span>期望到手工资</span><MoneyInput id="targetTakeHome" value={targetTakeHome} onChange={setTargetTakeHome} /></label>
        <SelectField id="reverseCity" label="缴费城市" value={city} onChange={setCity} options={Object.entries(cityRules).map(([key, item]) => ({ value: key, label: item.label }))} action={<Button className={styles.textButton} variant="text" type="button"><LocateFixed size={13} /> 自动定位</Button>} />
        <div className="field-grid"><SelectField className={styles.compactField} id="reverseMonth" label="计算月份" value={month} onChange={setMonth} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /><SelectField className={styles.compactField} id="reverseStartMonth" label="入职月份" value={startMonth} onChange={setStartMonth} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /></div>
        <div className="ratio-grid"><SelectField className={styles.compactField} id="employeeHousingRate" label="公积金个人比例" value={employeeHousingRate} onChange={setEmployeeHousingRate} options={housingRateOptions.map((rate) => ({ value: rate, label: `${rate}%` }))} /><SelectField className={styles.compactField} id="employerHousingRate" label="公积金单位比例" value={employerHousingRate} onChange={setEmployerHousingRate} options={housingRateOptions.map((rate) => ({ value: rate, label: `${rate}%` }))} /></div>
        <div className={styles.deductions}>
          <div className="label-with-action">
            <label htmlFor="reverseDeduction">专项附加扣除</label>
            <Button className={styles.textButton} variant="text" type="button" onClick={() => setDeductionDialogOpen(true)}>选择项目</Button>
          </div>
          <MoneyInput id="reverseDeduction" value={deductionAmount} onChange={(value) => { setDeductionAmount(value); setDeductions({}) }} />
          <p>{selectedDeductionItems.length > 0 ? `已选择 ${selectedDeductionItems.map((item) => item?.label).join('、')}，合计 ${money(deductionAmount)} / 月。` : '可直接输入本月专项附加扣除总额，也可以按项目选择后自动回填。'}</p>
        </div>
        <div className={styles.formActions}><Button variant="primary" type="submit">更新结果 <ArrowRight size={16} /></Button><Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button></div>
      </form>
      <section className={`${styles.result} panel`} aria-live="polite"><div className={styles.resultHeading}><div><span className={styles.sectionTitle}>反推结果</span><p>{rule.label} · {currentYear} 年 {month} 月</p></div><span className={styles.badge}>累计预扣</span></div><div className={styles.required}><span>预计税前月薪</span><strong>{money(result.salary)}</strong><p>若想本月到手约 {money(targetTakeHome)}，税前月薪需要约 {money(result.salary)}。</p></div><MetricGrid items={[{ label: '预计到手', value: money(result.result.takeHome, 2) }, { label: '本月个税', value: money(result.result.currentTax, 2) }, { label: '个人五险一金', value: money(employeeInsurance, 2) }, { label: '适用预扣率', value: `${rate}%` }]} /><div className={styles.resultExplain}><h3>怎么反推出来？</h3><p>系统会尝试不同税前工资，并按 {rule.label} 社保公积金规则和累计预扣法计算到手工资，直到结果接近期望到手。</p><dl><div><dt>社保缴费基数</dt><dd>{money(result.socialBase)}</dd></div><div><dt>公积金缴费基数</dt><dd>{money(result.housingBase)}</dd></div><div><dt>到手偏差</dt><dd>{money(result.gap, 2)}</dd></div></dl></div><ResultActions><ResultActionLink href="/calculator">进入工资计算器 <span>→</span></ResultActionLink><ResultActionButton onClick={copyResult}><Copy size={14} />复制结果</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions></section>
    </section>
    <ReverseProcess result={result} targetTakeHome={targetTakeHome} employeeInsurance={employeeInsurance} />
    <section className={styles.explain}><div><h2>结果怎么使用？</h2><p>反推结果适合用于谈薪、核对 offer 和预算估算。实际工资条可能受到奖金、补发工资、单位缴费口径等因素影响。</p></div><a href="/calculator">进入工资薪金计算器 <ArrowRight size={15} /></a></section>
    <SiteFooter />
  </main></div>
  <SpecialDeductionSelector
    open={deductionDialogOpen}
    value={deductions}
    emptyText="大病医疗通常在年度汇算时按实际发生额扣除，暂不参与本月工资反推。"
    onClose={() => setDeductionDialogOpen(false)}
    onSave={saveDeductions}
  />
  <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>
}

function ReverseProcess({ result, targetTakeHome, employeeInsurance }: { result: ReturnType<typeof calculateReverseTax>; targetTakeHome: number; employeeInsurance: number }) {
  const { money } = useMoneyFormat()
  const rate = Math.round(result.result.bracket.rate * 100)

  return <section className={styles.processPanel}><div className={styles.processHeading}><h2>计算过程</h2><p>先用二分法找到接近期望到手的税前工资，再套用工资薪金累计预扣法核算本月结果。</p></div><div className={styles.processSection}><h3>反推条件</h3><dl><div><dt>期望到手</dt><dd>{money(targetTakeHome)}</dd></div><div><dt>税前月薪</dt><dd>约 {money(result.salary)}</dd></div><div><dt>社保缴费基数</dt><dd>{money(result.socialBase)}</dd></div><div><dt>公积金缴费基数</dt><dd>{money(result.housingBase)}</dd></div></dl></div><div className={styles.processSection}><h3>本月核算</h3><dl><div><dt>累计应纳税所得额</dt><dd>{money(result.result.taxable)}</dd></div><div><dt>适用预扣率</dt><dd>{rate}%</dd></div><div><dt>本月个税</dt><dd>{money(result.result.currentTax, 2)}</dd></div><div><dt>到手工资</dt><dd>{money(result.salary)} - {money(employeeInsurance, 2)} - {money(result.result.currentTax, 2)} = {money(result.result.takeHome, 2)}</dd></div></dl></div></section>
}
