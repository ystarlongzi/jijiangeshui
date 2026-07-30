'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Award, Gift, RotateCcw } from 'lucide-react'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import MoneyInput from '../MoneyInput'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { calculateBonusTax } from '@/lib/bonus-tax'
import { bonusPolicyEndDate, currentYear } from '@/lib/site'

export default function BonusTaxClient() {
  const { money } = useMoneyFormat()
  const [bonus, setBonus] = useState(60000)
  const [annualSalary, setAnnualSalary] = useState(240000)
  const [annualInsurance, setAnnualInsurance] = useState(54000)
  const [annualDeductions, setAnnualDeductions] = useState(0)
  const result = useMemo(() => calculateBonusTax({ bonus, annualSalary, annualInsurance, annualDeductions }), [bonus, annualSalary, annualInsurance, annualDeductions])
  const reset = () => { setBonus(60000); setAnnualSalary(240000); setAnnualInsurance(54000); setAnnualDeductions(0) }

  return <div className="app-shell"><SiteHeader active="bonus-tax" /><main className="bonus-page">
    <header className="bonus-hero"><div><div className="bonus-eyebrow"><Gift size={18} />{currentYear} 年年终奖个税计算器</div><h1>年终奖，<br />哪种计税更划算？</h1><p>输入年终奖和全年收入，比较单独计税与并入综合所得后的奖金到手金额。</p></div><div className="bonus-policy-note"><strong>政策有效期</strong><span>全年一次性奖金单独计税政策执行至 {bonusPolicyEndDate}</span></div></header>
    <section className="bonus-workspace" aria-label="年终奖个税计算器">
      <form className="bonus-input panel" onSubmit={(event) => event.preventDefault()}><h2>计算你的年终奖</h2><BonusInput id="bonus" label="年终奖税前金额" value={bonus} onChange={setBonus} />
        <div className="bonus-form-grid"><BonusInput id="annualSalary" label="全年税前工资薪金" value={annualSalary} onChange={setAnnualSalary} /><BonusInput id="annualInsurance" label="全年个人社保公积金" value={annualInsurance} onChange={setAnnualInsurance} /><BonusInput id="annualDeductions" label="全年专项附加扣除" value={annualDeductions} onChange={setAnnualDeductions} /></div>
        <p className="bonus-form-note">全年工资、个人缴费和专项附加扣除用于估算并入综合所得方案，不等同于年度汇算最终结果。实际情况以工资条和申报信息为准。</p><div className="bonus-form-actions"><button className="primary-button" type="submit">更新计算结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div></form>
      <section className="bonus-result panel" aria-live="polite"><div className="bonus-result-heading"><div><span className="bonus-section-title">计算结果</span><p>{currentYear} 年 · 年终奖 {money(bonus)}</p></div><span className="bonus-badge">推荐方案</span></div><div className="bonus-recommendation"><span>预计更划算</span><strong>{result.better === 'separate' ? '单独计税' : '并入综合所得'}</strong><p>预计多到手 {money(result.difference)}。你可以根据单位发放和年度申报情况进一步确认。</p></div>{result.separateOptimization && <ThresholdAlert optimization={result.separateOptimization} bonus={bonus} />}<div className="bonus-comparison"><BonusResultCard title="单独计税" result={result.separate} active={result.better === 'separate'} note="年终奖除以 12 个月确定税率，再单独计算奖金税额。" /><BonusResultCard title="并入综合所得" result={result.combined} active={result.better === 'combined'} note="年终奖并入全年综合所得，按年度税率计算增量税额。" /></div><p className="bonus-result-note">以上为居民个人全年一次性奖金测算，不适用于劳务报酬、股权激励等其他收入类型。</p></section>
    </section>
    <BonusProcess result={result} bonus={bonus} annualSalary={annualSalary} annualInsurance={annualInsurance} annualDeductions={annualDeductions} />
    <section className="bonus-explain"><div><h2>两种方式怎么理解？</h2><p>符合条件的居民个人取得全年一次性奖金，可以选择不并入当年综合所得，单独计算纳税，也可以选择并入当年综合所得计算。</p></div><a href="https://fgk.chinatax.gov.cn/zcfgk/c102416/c5211524/content.html" target="_blank" rel="noreferrer">查看官方政策 <ArrowRight size={15} /></a></section>
    <SiteFooter />
  </main></div>
}

function ThresholdAlert({ optimization, bonus }: { optimization: NonNullable<ReturnType<typeof calculateBonusTax>['separateOptimization']>; bonus: number }) {
  const { money } = useMoneyFormat()
  return <div className="bonus-threshold-alert"><div className="bonus-alert-copy"><Award size={18} /><p>单独计税下，当前奖金跨过税率临界点。把金额调整到 <strong>{money(optimization.suggestedBonus)}</strong>，预计到手反而更多。</p></div><div className="bonus-threshold-grid"><div><span>当前奖金</span><strong>{money(bonus)}</strong><small>到手 {money(optimization.currentTakeHome)}</small></div><div><span>建议金额</span><strong>{money(optimization.suggestedBonus)}</strong><small>到手 {money(optimization.suggestedTakeHome)}</small></div><div><span>到手差额</span><strong>{money(optimization.difference)}</strong><small>少发奖金，少跨档</small></div></div></div>
}

function BonusProcess({ result, bonus, annualSalary, annualInsurance, annualDeductions }: { result: ReturnType<typeof calculateBonusTax>; bonus: number; annualSalary: number; annualInsurance: number; annualDeductions: number }) {
  const { money } = useMoneyFormat()
  const separateRate = Math.round(result.separate.bracket.rate * 100)
  const combinedRate = Math.round(result.combined.bracket.rate * 100)
  const bonusAverage = bonus / 12
  const standardDeduction = 60000

  return <section className="bonus-process-panel"><div className="bonus-process-heading"><h2>计算过程</h2><p>把两种计税方式拆开看，方便核对税率和到手金额。</p></div><div className="bonus-process-section"><h3>单独计税</h3><dl><div><dt>月均奖金</dt><dd>{money(bonus)} ÷ 12 = {money(bonusAverage, 2)}</dd></div><div><dt>适用税率</dt><dd>{separateRate}%</dd></div><div><dt>应缴个税</dt><dd>{money(bonus)} × {separateRate}% - {money(result.separate.bracket.quick / 12)} = {money(result.separate.tax)}</dd></div><div><dt>奖金到手</dt><dd>{money(bonus)} - {money(result.separate.tax)} = {money(result.separate.takeHome)}</dd></div></dl></div><div className="bonus-process-section"><h3>并入综合所得</h3><dl><div><dt>全年应纳税所得额</dt><dd>{money(annualSalary)} - {money(annualInsurance)} - {money(annualDeductions)} - {money(standardDeduction)} = {money(result.base.taxable)}</dd></div><div><dt>并入年终奖后</dt><dd>{money(result.base.taxable)} + {money(bonus)} = {money(result.combined.taxableIncome)}</dd></div><div><dt>适用税率</dt><dd>{combinedRate}%</dd></div><div><dt>增量个税</dt><dd>{money(result.combined.tax)}</dd></div><div><dt>奖金到手</dt><dd>{money(bonus)} - {money(result.combined.tax)} = {money(result.combined.takeHome)}</dd></div></dl></div></section>
}

function BonusInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return <label className="bonus-field" htmlFor={id}><span>{label}</span><MoneyInput id={id} value={value} onChange={onChange} /></label>
}

function BonusResultCard({ title, result, active, note }: { title: string; result: ReturnType<typeof calculateBonusTax>['separate']; active: boolean; note: string }) {
  const { money } = useMoneyFormat()
  return <article className={`bonus-result-card${active ? ' active' : ''}`}><div className="bonus-card-title"><h3>{title}</h3>{active && <span className="bonus-better"><Award size={16} />更优</span>}</div><div className="bonus-card-takehome"><small>奖金到手</small><strong>{money(result.takeHome)}</strong></div><dl><div><dt>应缴个税</dt><dd>{money(result.tax)}</dd></div><div><dt>适用税率</dt><dd>{Math.round(result.bracket.rate * 100)}%</dd></div></dl><p>{note}</p></article>
}
