'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Copy, Dice5, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import SiteHeader from '../SiteHeader'
import MoneyInput from '../MoneyInput'
import RuleSourcePanel from '../RuleSourcePanel'
import LongTailInfo from '../LongTailInfo'
import { copyText, resultLines } from '../clipboard'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { calculateFlatIncomeTax } from '@/lib/flat-income-tax'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'

export default function AccidentalTaxClient() {
  const { money } = useMoneyFormat()
  const [income, setIncome] = useState(10000)
  const [toast, setToast] = useState('')
  const result = useMemo(() => calculateFlatIncomeTax(income), [income])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  useEffect(() => {
    const requestedIncome = parseAmountParam(new URLSearchParams(window.location.search).get('income'))
    if (requestedIncome > 0) setIncome(requestedIncome)
  }, [])

  const reset = () => setIncome(10000)
  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/accidental-tax'
    url.search = new URLSearchParams({ income: String(Math.round(income)) }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前偶然所得计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }

  const copyResult = async () => {
    try {
      await copyText(resultLines([
        '偶然所得个税计算结果',
        `税前收入：${money(result.income)}`,
        '税率：20%',
        `应缴个税：${money(result.tax)}`,
        `税后收入：${money(result.takeHome)}`,
      ]))
      notify('已复制偶然所得计算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动复制结果')
    }
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className="labor-page">
    <header className="labor-hero">
      <div>
        <div className="bonus-eyebrow"><Dice5 size={18} />{currentYear} 年偶然所得个税计算器</div>
        <h1>中奖得奖，<br />到手多少？</h1>
        <p>输入中奖、得奖、中彩等偶然所得税前收入，按 20% 比例税率估算应缴个税和税后收入。</p>
      </div>
      <div className="labor-hero-note"><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className="labor-workspace" aria-label="偶然所得个税计算器">
      <form className="labor-input panel" onSubmit={(event) => event.preventDefault()}>
        <h2>计算偶然所得</h2>
        <label className="bonus-field" htmlFor="accidentalIncome"><span>本次税前收入</span><MoneyInput id="accidentalIncome" value={income} onChange={setIncome} /></label>
        <p className="bonus-form-note">偶然所得以每次取得该项收入为一次，通常直接按 20% 比例税率计算个人所得税。</p>
        <div className="bonus-form-actions"><button className="primary-button" type="submit">更新计算结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div>
      </form>

      <section className="labor-result panel" aria-live="polite">
        <div className="bonus-result-heading"><div><span className="bonus-section-title">计算结果</span><p>{currentYear} 年 · 偶然所得 {money(income)}</p></div><span className="bonus-badge">20% 税率</span></div>
        <div className="labor-takehome"><span>预计税后收入</span><strong>{money(result.takeHome)}</strong><p>应缴个税 {money(result.tax)}。</p></div>
        <div className="reverse-metrics"><div><span>税前收入</span><strong>{money(result.income)}</strong></div><div><span>税率</span><strong>20%</strong></div><div><span>应缴个税</span><strong>{money(result.tax)}</strong></div><div><span>税后收入</span><strong>{money(result.takeHome)}</strong></div></div>
        <div className="labor-process">
          <h3>计算过程</h3>
          <dl>
            <div><dt>应缴个税</dt><dd>{money(income)} × 20% = {money(result.tax)}</dd></div>
            <div><dt>税后收入</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <div className="result-actions"><Link className="link-button" href="/tax-rate">查看税率表 <span>→</span></Link><button className="link-button icon-link-button" type="button" onClick={copyResult}><Copy size={14} />复制结果</button><button className="link-button icon-link-button" type="button" onClick={copyShareLink}><Copy size={14} />复制链接</button></div>
      </section>
    </section>

    <section className="bonus-explain"><div><h2>偶然所得怎么扣？</h2><p>偶然所得通常不扣除费用，以每次收入额作为应纳税所得额，按 20% 比例税率计算个人所得税。</p></div><Link href="/dividend-tax">算利息股息红利 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="accidental" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>
}
