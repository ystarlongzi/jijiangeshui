'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, LocateFixed, RotateCcw, X } from 'lucide-react'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import MoneyInput from '../MoneyInput'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { calculateReverseTax } from '@/lib/reverse-tax'
import { currentYear } from '@/lib/site'
import { cityRules, housingRateOptions } from '@/lib/tax-rules'
import { specialDeductionGroups, specialDeductionItems, sumSpecialDeductions } from '@/lib/special-deductions'

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
  const [draftDeductions, setDraftDeductions] = useState<Record<string, string>>({})
  const [expandedDeductionGroups, setExpandedDeductionGroups] = useState<string[]>([])
  const rule = cityRules[city]
  const selectedDeductionItems = Object.values(deductions).map((id) => specialDeductionItems.find((item) => item.id === id)).filter(Boolean)
  const selectedDeductionAmount = sumSpecialDeductions(deductions)
  const draftDeductionAmount = sumSpecialDeductions(draftDeductions)
  const result = useMemo(() => calculateReverseTax({ targetTakeHome, rule, month, startMonth, deduction: deductionAmount, employeeHousingRate, employerHousingRate }), [targetTakeHome, rule, month, startMonth, deductionAmount, employeeHousingRate, employerHousingRate])
  const employeeInsurance = result.insurance.reduce((sum, item) => sum + item.employee, 0)
  const rate = Math.round(result.result.bracket.rate * 100)
  const selectDraftDeduction = (group: string, option: string) => setDraftDeductions((current) => current[group] === option ? omitDeductionGroup(current, group) : { ...current, [group]: option })
  const toggleDeductionGroup = (group: string) => setExpandedDeductionGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group])
  const omitDeductionGroup = (current: Record<string, string>, group: string) => {
    const next = { ...current }
    delete next[group]
    return next
  }
  const openDeductionDialog = () => { setDraftDeductions(deductions); setDeductionDialogOpen(true) }
  const saveDeductions = () => { setDeductions(draftDeductions); setDeductionAmount(draftDeductionAmount); setDeductionDialogOpen(false) }
  const reset = () => { setTargetTakeHome(15000); setCity('beijing'); setMonth(8); setStartMonth(1); setEmployeeHousingRate(12); setEmployerHousingRate(12); setDeductionAmount(0); setDeductions({}); setDraftDeductions({}); setDeductionDialogOpen(false) }

  return <>
  <div className="app-shell"><SiteHeader active="reverse-tax" /><main className="reverse-page">
    <header className="reverse-hero"><div><p className="eyebrow">{currentYear} 年税后反推计算器</p><h1>税后工资，反推税前。</h1><p>输入期望到手工资，结合城市缴费规则、专项扣除和累计预扣，估算需要的税前月薪。</p></div><div className="reverse-hero-card"><span>反推结果会受月份影响</span><strong>{rule.label} · {currentYear} 年 {month} 月</strong></div></header>
    <section className="reverse-workspace" aria-label="税后反推税前工资">
      <form className="reverse-input panel" onSubmit={(event) => event.preventDefault()}>
        <h2>反推条件</h2>
        <label className="bonus-field" htmlFor="targetTakeHome"><span>期望到手工资</span><MoneyInput id="targetTakeHome" value={targetTakeHome} onChange={setTargetTakeHome} /></label>
        <div className="field-block"><div className="label-with-action"><label htmlFor="reverseCity">缴费城市</label><button className="text-button" type="button"><LocateFixed size={13} /> 自动定位</button></div><div className="select-wrap"><select id="reverseCity" value={city} onChange={(event) => setCity(event.target.value)}>{Object.entries(cityRules).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div></div>
        <div className="field-grid"><SelectField id="reverseMonth" label="计算月份" value={month} onChange={setMonth} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /><SelectField id="reverseStartMonth" label="入职月份" value={startMonth} onChange={setStartMonth} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1} 月` }))} /></div>
        <div className="ratio-grid"><SelectField id="employeeHousingRate" label="公积金个人比例" value={employeeHousingRate} onChange={setEmployeeHousingRate} options={housingRateOptions.map((rate) => ({ value: rate, label: `${rate}%` }))} /><SelectField id="employerHousingRate" label="公积金单位比例" value={employerHousingRate} onChange={setEmployerHousingRate} options={housingRateOptions.map((rate) => ({ value: rate, label: `${rate}%` }))} /></div>
        <div className="reverse-deductions">
          <div className="label-with-action">
            <label htmlFor="reverseDeduction">专项附加扣除</label>
            <button className="text-button" type="button" onClick={openDeductionDialog}>选择项目</button>
          </div>
          <MoneyInput id="reverseDeduction" value={deductionAmount} onChange={(value) => { setDeductionAmount(value); setDeductions({}) }} />
          <p>{selectedDeductionItems.length > 0 ? `已选择 ${selectedDeductionItems.map((item) => item?.label).join('、')}，合计 ${money(selectedDeductionAmount)} / 月。` : '可直接输入本月专项附加扣除总额，也可以按项目选择后自动回填。'}</p>
        </div>
        <div className="bonus-form-actions"><button className="primary-button" type="submit">更新结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div>
      </form>
      <section className="reverse-result panel" aria-live="polite"><div className="bonus-result-heading"><div><span className="bonus-section-title">反推结果</span><p>{rule.label} · {currentYear} 年 {month} 月</p></div><span className="bonus-badge">累计预扣</span></div><div className="reverse-required"><span>预计税前月薪</span><strong>{money(result.salary)}</strong><p>若想本月到手约 {money(targetTakeHome)}，税前月薪需要约 {money(result.salary)}。</p></div><div className="reverse-metrics"><div><span>预计到手</span><strong>{money(result.result.takeHome, 2)}</strong></div><div><span>本月个税</span><strong>{money(result.result.currentTax, 2)}</strong></div><div><span>个人五险一金</span><strong>{money(employeeInsurance, 2)}</strong></div><div><span>适用预扣率</span><strong>{rate}%</strong></div></div><div className="reverse-explain"><h3>怎么反推出来？</h3><p>系统会尝试不同税前工资，并按 {rule.label} 社保公积金规则和累计预扣法计算到手工资，直到结果接近期望到手。</p><dl><div><dt>社保缴费基数</dt><dd>{money(result.socialBase)}</dd></div><div><dt>公积金缴费基数</dt><dd>{money(result.housingBase)}</dd></div><div><dt>到手偏差</dt><dd>{money(result.gap, 2)}</dd></div></dl></div></section>
    </section>
    <section className="bonus-explain"><div><h2>结果怎么使用？</h2><p>反推结果适合用于谈薪、核对 offer 和预算估算。实际工资条可能受到奖金、补发工资、单位缴费口径等因素影响。</p></div><a href="/calculator">进入工资薪金计算器 <ArrowRight size={15} /></a></section>
    <SiteFooter />
  </main></div>
  {deductionDialogOpen && <div className="deduction-dialog-backdrop" role="presentation" onClick={() => setDeductionDialogOpen(false)}>
    <section className="deduction-dialog panel" role="dialog" aria-modal="true" aria-labelledby="deductionDialogTitle" onClick={(event) => event.stopPropagation()}>
      <div className="deduction-dialog-heading">
        <div><h2 id="deductionDialogTitle">选择专项附加扣除</h2><p>选择后会按月扣除额汇总，并回填到输入框内。</p></div>
        <button className="icon-button" type="button" aria-label="关闭" onClick={() => setDeductionDialogOpen(false)}><X size={17} /></button>
      </div>
      <div className="deduction-option-list">
        {specialDeductionGroups.map((group) => {
          const selectedOption = specialDeductionItems.find((item) => item.id === draftDeductions[group.key])
          const expanded = expandedDeductionGroups.includes(group.key)
          return <div className={`deduction-group${group.options.length === 0 ? ' disabled' : ''}`} key={group.key}>
          <button className="deduction-group-heading" type="button" onClick={() => toggleDeductionGroup(group.key)} aria-expanded={expanded}>
            <span className={`deduction-group-status${selectedOption ? ' selected' : ''}`} aria-hidden="true" />
            <span><strong>{group.title}{selectedOption && <b>{money(selectedOption.amount)} / 月</b>}</strong><small>{group.note}</small></span>
            <ChevronDown size={16} />
          </button>
          {expanded && (group.options.length > 0 ? <div className="deduction-option-grid">
            {group.options.map((item) => <label className={`deduction-option${draftDeductions[group.key] === item.id ? ' selected' : ''}`} key={item.id}>
              <input type="checkbox" checked={draftDeductions[group.key] === item.id} onChange={() => selectDraftDeduction(group.key, item.id)} />
              <span>{item.label}</span>
              <b>{money(item.amount)} / 月</b>
            </label>)}
          </div> : <p>大病医疗通常在年度汇算时按实际发生额扣除，暂不参与本月工资反推。</p>)}
        </div>
        })}
      </div>
      <div className="deduction-dialog-footer">
        <div className="deduction-dialog-summary">
          <span>本月合计</span>
          <strong>{money(draftDeductionAmount)}</strong>
        </div>
        <div className="deduction-dialog-actions">
          <button className="secondary-button" type="button" onClick={() => setDraftDeductions({})}>清空选择</button>
          <button className="primary-button" type="button" onClick={saveDeductions}>保存并回填 <ArrowRight size={16} /></button>
        </div>
      </div>
    </section>
  </div>}
  </>
}

function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: number; onChange: (value: number) => void; options: { value: number; label: string }[] }) {
  return <div className="field-block"><label htmlFor={id}>{label}</label><div className="select-wrap"><select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
}
