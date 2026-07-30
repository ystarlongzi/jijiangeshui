'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BadgePercent, Copy, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import SiteHeader from '../SiteHeader'
import MoneyInput from '../MoneyInput'
import RuleSourcePanel from '../RuleSourcePanel'
import LongTailInfo from '../LongTailInfo'
import { copyText, resultLines } from '../clipboard'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { calculateLicenseTax } from '@/lib/license-tax'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'

export default function LicenseTaxClient() {
  const { money } = useMoneyFormat()
  const [income, setIncome] = useState(10000)
  const [toast, setToast] = useState('')
  const result = useMemo(() => calculateLicenseTax(income), [income])

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
    url.pathname = '/license-tax'
    url.search = new URLSearchParams({ income: String(Math.round(income)) }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前特许权使用费计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }

  const copyResult = async () => {
    try {
      await copyText(resultLines([
        '特许权使用费个税计算结果',
        `税前收入：${money(income)}`,
        `费用扣除：${money(result.deduction)}`,
        `应纳税所得额：${money(result.taxable)}`,
        '预扣率：20%',
        `预扣个税：${money(result.tax)}`,
        `预计到手：${money(result.takeHome)}`,
      ]))
      notify('已复制特许权使用费计算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动复制结果')
    }
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className="labor-page">
    <header className="labor-hero">
      <div>
        <div className="bonus-eyebrow"><BadgePercent size={18} />{currentYear} 年特许权使用费个税计算器</div>
        <h1>特许权收入，<br />税后多少？</h1>
        <p>输入专利、商标、著作权等特许权使用费税前收入，估算费用扣除、预扣个税和税后到手金额。</p>
      </div>
      <div className="labor-hero-note"><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className="labor-workspace" aria-label="特许权使用费个税计算器">
      <form className="labor-input panel" onSubmit={(event) => event.preventDefault()}>
        <h2>计算特许权使用费</h2>
        <label className="bonus-field" htmlFor="licenseIncome"><span>特许权使用费税前收入</span><MoneyInput id="licenseIncome" value={income} onChange={setIncome} /></label>
        <p className="bonus-form-note">居民个人特许权使用费通常先扣除费用，再按 20% 比例预扣个人所得税。</p>
        <div className="bonus-form-actions"><button className="primary-button" type="submit">更新计算结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div>
      </form>

      <section className="labor-result panel" aria-live="polite">
        <div className="bonus-result-heading"><div><span className="bonus-section-title">计算结果</span><p>{currentYear} 年 · 特许权使用费 {money(income)}</p></div><span className="bonus-badge">居民个人</span></div>
        <div className="labor-takehome"><span>预计到手</span><strong>{money(result.takeHome)}</strong><p>预扣个税 {money(result.tax)}，适用 20% 比例预扣率。</p></div>
        <div className="reverse-metrics"><div><span>费用扣除</span><strong>{money(result.deduction)}</strong></div><div><span>应纳税所得额</span><strong>{money(result.taxable)}</strong></div><div><span>预扣率</span><strong>20%</strong></div><div><span>预扣个税</span><strong>{money(result.tax)}</strong></div></div>
        <div className="labor-process">
          <h3>计算过程</h3>
          <dl>
            <div><dt>费用扣除</dt><dd>{income <= 4000 ? `${money(income)} 中扣除 ${money(result.deduction)}` : `${money(income)} × 20% = ${money(result.deduction)}`}</dd></div>
            <div><dt>应纳税所得额</dt><dd>{money(income)} - {money(result.deduction)} = {money(result.taxable)}</dd></div>
            <div><dt>预扣个税</dt><dd>{money(result.taxable)} × 20% = {money(result.tax)}</dd></div>
            <div><dt>税后到手</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <div className="result-actions"><Link className="link-button" href="/tax-rate">查看税率表 <span>→</span></Link><button className="link-button icon-link-button" type="button" onClick={copyResult}><Copy size={14} />复制结果</button><button className="link-button icon-link-button" type="button" onClick={copyShareLink}><Copy size={14} />复制链接</button></div>
      </section>
    </section>

    <section className="bonus-explain"><div><h2>和稿酬有什么不同？</h2><p>特许权使用费通常不适用稿酬所得“收入额减按 70%”的规则，适合专利、商标、著作权等使用权收入测算。</p></div><Link href="/author-tax">算稿酬 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="license" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>
}
