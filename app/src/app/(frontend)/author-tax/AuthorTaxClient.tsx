'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpenText, Copy, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import SiteHeader from '../SiteHeader'
import MoneyInput from '../MoneyInput'
import RuleSourcePanel from '../RuleSourcePanel'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { calculateAuthorTax } from '@/lib/author-tax'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'

export default function AuthorTaxClient() {
  const { money } = useMoneyFormat()
  const [income, setIncome] = useState(10000)
  const [toast, setToast] = useState('')
  const result = useMemo(() => calculateAuthorTax(income), [income])

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
    url.pathname = '/author-tax'
    url.search = new URLSearchParams({ income: String(Math.round(income)) }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前稿酬计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className="labor-page">
    <header className="labor-hero">
      <div>
        <div className="bonus-eyebrow"><BookOpenText size={18} />{currentYear} 年稿酬个税计算器</div>
        <h1>稿酬收入，<br />扣多少税？</h1>
        <p>输入稿酬税前收入，按居民个人稿酬所得预扣规则估算费用扣除、减按 70%、预扣个税和税后到手金额。</p>
      </div>
      <div className="labor-hero-note"><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className="labor-workspace" aria-label="稿酬个税计算器">
      <form className="labor-input panel" onSubmit={(event) => event.preventDefault()}>
        <h2>计算稿酬收入</h2>
        <label className="bonus-field" htmlFor="authorIncome"><span>稿酬税前收入</span><MoneyInput id="authorIncome" value={income} onChange={setIncome} /></label>
        <p className="bonus-form-note">稿酬所得先按劳务类规则扣除费用，再将收入额减按 70% 计算，通常按 20% 比例预扣。</p>
        <div className="bonus-form-actions"><button className="primary-button" type="submit">更新计算结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div>
      </form>

      <section className="labor-result panel" aria-live="polite">
        <div className="bonus-result-heading"><div><span className="bonus-section-title">计算结果</span><p>{currentYear} 年 · 稿酬 {money(income)}</p></div><span className="bonus-badge">居民个人</span></div>
        <div className="labor-takehome"><span>预计到手</span><strong>{money(result.takeHome)}</strong><p>预扣个税 {money(result.tax)}，适用 20% 比例预扣率。</p></div>
        <div className="reverse-metrics"><div><span>费用扣除</span><strong>{money(result.expenseDeduction)}</strong></div><div><span>减按 70% 后</span><strong>{money(result.taxable)}</strong></div><div><span>预扣率</span><strong>20%</strong></div><div><span>预扣个税</span><strong>{money(result.tax)}</strong></div></div>
        <div className="labor-process">
          <h3>计算过程</h3>
          <dl>
            <div><dt>费用扣除</dt><dd>{income <= 4000 ? `${money(income)} 中扣除 ${money(result.expenseDeduction)}` : `${money(income)} × 20% = ${money(result.expenseDeduction)}`}</dd></div>
            <div><dt>扣除费用后</dt><dd>{money(income)} - {money(result.expenseDeduction)} = {money(result.incomeAfterExpense)}</dd></div>
            <div><dt>减按 70%</dt><dd>{money(result.incomeAfterExpense)} × 70% = {money(result.taxable)}</dd></div>
            <div><dt>预扣个税</dt><dd>{money(result.taxable)} × 20% = {money(result.tax)}</dd></div>
            <div><dt>税后到手</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <div className="result-actions"><Link className="link-button" href="/tax-rate">查看税率表 <span>→</span></Link><button className="link-button icon-link-button" type="button" onClick={copyShareLink}><Copy size={14} />复制链接</button></div>
      </section>
    </section>

    <section className="bonus-explain"><div><h2>稿酬和劳务报酬有什么不同？</h2><p>稿酬所得通常指作品出版、发表取得的收入。和一般劳务报酬相比，稿酬所得收入额按规定减按 70% 计算。</p></div><Link href="/labor-tax">算劳务报酬 <ReceiptText size={15} /></Link></section>
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>
}
