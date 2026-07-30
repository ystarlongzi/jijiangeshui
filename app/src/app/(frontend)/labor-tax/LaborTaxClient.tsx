'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, Copy, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import SiteHeader from '../SiteHeader'
import MoneyInput from '../MoneyInput'
import RuleSourcePanel from '../RuleSourcePanel'
import { copyText, resultLines } from '../clipboard'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { calculateLaborTax } from '@/lib/labor-tax'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'

export default function LaborTaxClient() {
  const { money } = useMoneyFormat()
  const [income, setIncome] = useState(10000)
  const [toast, setToast] = useState('')
  const result = useMemo(() => calculateLaborTax(income), [income])
  const rate = Math.round(result.bracket.rate * 100)

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
    url.pathname = '/labor-tax'
    url.search = new URLSearchParams({ income: String(Math.round(income)) }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前劳务报酬计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }

  const copyResult = async () => {
    try {
      await copyText(resultLines([
        '劳务报酬个税计算结果',
        `税前收入：${money(income)}`,
        `费用扣除：${money(result.deduction)}`,
        `应纳税所得额：${money(result.taxable)}`,
        `预扣率：${rate}%`,
        `速算扣除数：${money(result.bracket.quick)}`,
        `预扣个税：${money(result.tax)}`,
        `预计到手：${money(result.takeHome)}`,
      ]))
      notify('已复制劳务报酬计算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动复制结果')
    }
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className="labor-page">
    <header className="labor-hero">
      <div>
        <div className="bonus-eyebrow"><BriefcaseBusiness size={18} />{currentYear} 年劳务报酬个税计算器</div>
        <h1>劳务报酬，<br />到手多少？</h1>
        <p>输入劳务报酬税前收入，按居民个人劳务报酬预扣规则估算费用扣除、预扣个税和税后到手金额。</p>
      </div>
      <div className="labor-hero-note"><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className="labor-workspace" aria-label="劳务报酬个税计算器">
      <form className="labor-input panel" onSubmit={(event) => event.preventDefault()}>
        <h2>计算劳务报酬</h2>
        <label className="bonus-field" htmlFor="laborIncome"><span>劳务报酬税前收入</span><MoneyInput id="laborIncome" value={income} onChange={setIncome} /></label>
        <p className="bonus-form-note">居民个人劳务报酬通常按次或按月预扣。每次收入不超过 4000 元，费用按 800 元扣除；超过 4000 元，费用按收入 20% 扣除。</p>
        <div className="bonus-form-actions"><button className="primary-button" type="submit">更新计算结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div>
      </form>

      <section className="labor-result panel" aria-live="polite">
        <div className="bonus-result-heading"><div><span className="bonus-section-title">计算结果</span><p>{currentYear} 年 · 劳务报酬 {money(income)}</p></div><span className="bonus-badge">居民个人</span></div>
        <div className="labor-takehome"><span>预计到手</span><strong>{money(result.takeHome)}</strong><p>预扣个税 {money(result.tax)}，适用预扣率 {rate}%。</p></div>
        <div className="reverse-metrics"><div><span>费用扣除</span><strong>{money(result.deduction)}</strong></div><div><span>应纳税所得额</span><strong>{money(result.taxable)}</strong></div><div><span>预扣率</span><strong>{rate}%</strong></div><div><span>速算扣除数</span><strong>{money(result.bracket.quick)}</strong></div></div>
        <div className="labor-process">
          <h3>计算过程</h3>
          <dl>
            <div><dt>费用扣除</dt><dd>{income <= 4000 ? `${money(income)} 中扣除 ${money(result.deduction)}` : `${money(income)} × 20% = ${money(result.deduction)}`}</dd></div>
            <div><dt>应纳税所得额</dt><dd>{money(income)} - {money(result.deduction)} = {money(result.taxable)}</dd></div>
            <div><dt>预扣个税</dt><dd>{money(result.taxable)} × {rate}% - {money(result.bracket.quick)} = {money(result.tax)}</dd></div>
            <div><dt>税后到手</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <div className="result-actions"><Link className="link-button" href="/tax-rate">查看税率表 <span>→</span></Link><button className="link-button icon-link-button" type="button" onClick={copyResult}><Copy size={14} />复制结果</button><button className="link-button icon-link-button" type="button" onClick={copyShareLink}><Copy size={14} />复制链接</button></div>
      </section>
    </section>

    <section className="bonus-explain"><div><h2>适合哪些收入？</h2><p>常见于独立设计、咨询、讲课、翻译、技术服务等非雇佣性质收入。年度汇算时，居民个人劳务报酬通常会并入综合所得。</p></div><Link href="/calculator">算工资薪金 <ReceiptText size={15} /></Link></section>
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>
}
