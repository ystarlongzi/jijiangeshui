'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Award, Copy, Download, Gift, RotateCcw } from 'lucide-react'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import MoneyInput from '../MoneyInput'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { trackEvent } from '../analytics'
import { downloadCsv } from '../csv'
import { calculateBonusTax } from '@/lib/bonus-tax'
import { bonusPolicyEndDate, currentYear } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'

export default function BonusTaxClient() {
  const { money } = useMoneyFormat()
  const [bonus, setBonus] = useState(60000)
  const [annualSalary, setAnnualSalary] = useState(240000)
  const [annualInsurance, setAnnualInsurance] = useState(54000)
  const [annualDeductions, setAnnualDeductions] = useState(0)
  const [toast, setToast] = useState('')
  const result = useMemo(() => calculateBonusTax({ bonus, annualSalary, annualInsurance, annualDeductions }), [bonus, annualSalary, annualInsurance, annualDeductions])
  const reset = () => { setBonus(60000); setAnnualSalary(240000); setAnnualInsurance(54000); setAnnualDeductions(0) }
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedBonus = parseAmountParam(params.get('bonus'))
    const requestedAnnualSalary = parseAmountParam(params.get('annualSalary'))
    const requestedAnnualInsurance = parseAmountParam(params.get('annualInsurance'))
    const requestedAnnualDeductions = parseAmountParam(params.get('annualDeductions'))

    if (requestedBonus > 0) setBonus(requestedBonus)
    if (requestedAnnualSalary > 0) setAnnualSalary(requestedAnnualSalary)
    if (requestedAnnualInsurance > 0) setAnnualInsurance(requestedAnnualInsurance)
    if (requestedAnnualDeductions > 0) setAnnualDeductions(requestedAnnualDeductions)
  }, [])
  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/bonus-tax'
    url.search = new URLSearchParams({
      bonus: String(Math.round(bonus)),
      annualSalary: String(Math.round(annualSalary)),
      annualInsurance: String(Math.round(annualInsurance)),
      annualDeductions: String(Math.round(annualDeductions)),
    }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      trackEvent('share_link', { calculator: 'bonus_tax', better: result.better })
      notify('已复制当前年终奖计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }
  const copyResult = async () => {
    const betterLabel = result.better === 'separate' ? '单独计税' : '并入综合所得'
    const lines = [
      `${currentYear} 年年终奖个税测算`,
      `年终奖税前金额：${money(bonus)}`,
      `全年税前工资薪金：${money(annualSalary)}`,
      `全年个人社保公积金：${money(annualInsurance)}`,
      `全年专项附加扣除：${money(annualDeductions)}`,
      '',
      `推荐方案：${betterLabel}`,
      `预计多到手：${money(result.difference)}`,
      `单独计税：到手 ${money(result.separate.takeHome)}，个税 ${money(result.separate.tax)}，税率 ${Math.round(result.separate.bracket.rate * 100)}%`,
      `并入综合所得：到手 ${money(result.combined.takeHome)}，个税 ${money(result.combined.tax)}，税率 ${Math.round(result.combined.bracket.rate * 100)}%`,
      result.separateOptimization ? `临界点提示：把金额调整到 ${money(result.separateOptimization.suggestedBonus)}，预计到手 ${money(result.separateOptimization.suggestedTakeHome)}。` : '',
      '',
      '结果仅供测算，最终以官方和扣缴单位口径为准。',
    ].filter(Boolean).join('\n')

    try {
      await navigator.clipboard.writeText(lines)
      trackEvent('copy_result', { calculator: 'bonus_tax', better: result.better })
      notify('已复制年终奖测算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动选择结果')
    }
  }
  const exportCsv = () => {
    const betterLabel = result.better === 'separate' ? '单独计税' : '并入综合所得'
    const rows = [
      ['项目', '金额/结果', '说明'],
      ['年终奖税前金额', bonus.toFixed(2), '用户输入'],
      ['全年税前工资薪金', annualSalary.toFixed(2), '用于估算并入综合所得方案'],
      ['全年个人社保公积金', annualInsurance.toFixed(2), '用于估算并入综合所得方案'],
      ['全年专项附加扣除', annualDeductions.toFixed(2), '用于估算并入综合所得方案'],
      ['推荐方案', betterLabel, `预计多到手 ${result.difference.toFixed(2)}`],
      ['单独计税-奖金到手', result.separate.takeHome.toFixed(2), `个税 ${result.separate.tax.toFixed(2)}，税率 ${Math.round(result.separate.bracket.rate * 100)}%`],
      ['并入综合所得-奖金到手', result.combined.takeHome.toFixed(2), `个税 ${result.combined.tax.toFixed(2)}，税率 ${Math.round(result.combined.bracket.rate * 100)}%`],
      ['临界点建议', result.separateOptimization ? result.separateOptimization.suggestedBonus.toFixed(2) : '', result.separateOptimization ? `预计到手 ${result.separateOptimization.suggestedTakeHome.toFixed(2)}` : '未触发'],
    ]
    trackEvent('export_csv', { calculator: 'bonus_tax', better: result.better, rows: rows.length - 1 })
    downloadCsv(`年终奖个税测算-${currentYear}.csv`, rows)
    notify('已导出年终奖测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader active="bonus-tax" /><main className="bonus-page">
    <header className="bonus-hero"><div><div className="bonus-eyebrow"><Gift size={18} />{currentYear} 年年终奖个税计算器</div><h1>年终奖，<br />哪种计税更划算？</h1><p>输入年终奖和全年收入，比较单独计税与并入综合所得后的奖金到手金额。</p></div><div className="bonus-policy-note"><strong>政策有效期</strong><span>全年一次性奖金单独计税政策执行至 {bonusPolicyEndDate}</span></div></header>
    <section className="bonus-workspace" aria-label="年终奖个税计算器">
      <form className="bonus-input panel" onSubmit={(event) => { event.preventDefault(); trackEvent('calculate_complete', { calculator: 'bonus_tax', better: result.better, hasThresholdTip: Boolean(result.separateOptimization) }) }}><h2>计算你的年终奖</h2><BonusInput id="bonus" label="年终奖税前金额" value={bonus} onChange={setBonus} />
        <div className="bonus-form-grid"><BonusInput id="annualSalary" label="全年税前工资薪金" value={annualSalary} onChange={setAnnualSalary} /><BonusInput id="annualInsurance" label="全年个人社保公积金" value={annualInsurance} onChange={setAnnualInsurance} /><BonusInput id="annualDeductions" label="全年专项附加扣除" value={annualDeductions} onChange={setAnnualDeductions} /></div>
        <p className="bonus-form-note">全年工资、个人缴费和专项附加扣除用于估算并入综合所得方案，不等同于年度汇算最终结果。实际情况以工资条和申报信息为准。</p><div className="bonus-form-actions"><button className="primary-button" type="submit">更新计算结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div></form>
      <section className="bonus-result panel" aria-live="polite"><div className="bonus-result-heading"><div><span className="bonus-section-title">计算结果</span><p>{currentYear} 年 · 年终奖 {money(bonus)}</p></div><span className="bonus-badge">推荐方案</span></div><div className="bonus-recommendation"><span>预计更划算</span><strong>{result.better === 'separate' ? '单独计税' : '并入综合所得'}</strong><p>预计多到手 {money(result.difference)}。你可以根据单位发放和年度申报情况进一步确认。</p></div>{result.separateOptimization && <ThresholdAlert optimization={result.separateOptimization} bonus={bonus} />}<div className="bonus-comparison"><BonusResultCard title="单独计税" result={result.separate} active={result.better === 'separate'} note="年终奖除以 12 个月确定税率，再单独计算奖金税额。" /><BonusResultCard title="并入综合所得" result={result.combined} active={result.better === 'combined'} note="年终奖并入全年综合所得，按年度税率计算增量税额。" /></div><p className="bonus-result-note">以上为居民个人全年一次性奖金测算，不适用于劳务报酬、股权激励等其他收入类型。</p><div className="result-actions"><a className="link-button" href="/tax-rate">查看税率表 <span>→</span></a><button className="link-button icon-link-button" type="button" onClick={exportCsv}><Download size={14} />导出 CSV</button><button className="link-button icon-link-button" type="button" onClick={copyResult}><Copy size={14} />复制结果</button><button className="link-button icon-link-button" type="button" onClick={copyShareLink}><Copy size={14} />复制链接</button></div></section>
    </section>
    <BonusProcess result={result} bonus={bonus} annualSalary={annualSalary} annualInsurance={annualInsurance} annualDeductions={annualDeductions} />
    <section className="bonus-explain"><div><h2>两种方式怎么理解？</h2><p>符合条件的居民个人取得全年一次性奖金，可以选择不并入当年综合所得，单独计算纳税，也可以选择并入当年综合所得计算。</p></div><a href="https://fgk.chinatax.gov.cn/zcfgk/c102416/c5211524/content.html" target="_blank" rel="noreferrer">查看官方政策 <ArrowRight size={15} /></a></section>
    <SiteFooter />
  </main></div>
  <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>
}

function ThresholdAlert({ optimization, bonus }: { optimization: NonNullable<ReturnType<typeof calculateBonusTax>['separateOptimization']>; bonus: number }) {
  const { money } = useMoneyFormat()
  const maxValue = Math.max(bonus, optimization.suggestedBonus, optimization.currentTakeHome, optimization.suggestedTakeHome)
  const currentTakeHomeWidth = `${Math.max(6, (optimization.currentTakeHome / maxValue) * 100)}%`
  const suggestedTakeHomeWidth = `${Math.max(6, (optimization.suggestedTakeHome / maxValue) * 100)}%`
  const currentBonusWidth = `${Math.max(6, (bonus / maxValue) * 100)}%`
  const suggestedBonusWidth = `${Math.max(6, (optimization.suggestedBonus / maxValue) * 100)}%`

  return <div className="bonus-threshold-alert"><div className="bonus-alert-copy"><Award size={18} /><p>单独计税下，当前奖金跨过税率临界点。把金额调整到 <strong>{money(optimization.suggestedBonus)}</strong>，预计到手反而更多。</p></div><div className="bonus-threshold-grid"><div><span>当前奖金</span><strong>{money(bonus)}</strong><small>到手 {money(optimization.currentTakeHome)}</small></div><div><span>建议金额</span><strong>{money(optimization.suggestedBonus)}</strong><small>到手 {money(optimization.suggestedTakeHome)}</small></div><div><span>到手差额</span><strong>{money(optimization.difference)}</strong><small>少发奖金，少跨档</small></div></div><div className="bonus-threshold-chart" aria-label="年终奖临界点到手对比"><div className="threshold-chart-row"><span>当前税前</span><i style={{ width: currentBonusWidth }} /><strong>{money(bonus)}</strong></div><div className="threshold-chart-row"><span>当前到手</span><i className="takehome-bar" style={{ width: currentTakeHomeWidth }} /><strong>{money(optimization.currentTakeHome)}</strong></div><div className="threshold-chart-row recommended"><span>建议税前</span><i style={{ width: suggestedBonusWidth }} /><strong>{money(optimization.suggestedBonus)}</strong></div><div className="threshold-chart-row recommended"><span>建议到手</span><i className="takehome-bar" style={{ width: suggestedTakeHomeWidth }} /><strong>{money(optimization.suggestedTakeHome)}</strong></div></div></div>
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
