'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpenText, Copy, Download, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import { Button } from '../Button'
import Toast from '../Toast'
import SiteHeader from '../SiteHeader'
import MoneyInput from '../MoneyInput'
import MetricGrid from '../MetricGrid'
import RuleSourcePanel from '../RuleSourcePanel'
import LongTailInfo from '../LongTailInfo'
import ResultActions, { ResultActionButton, ResultActionLink } from '../ResultActions/ResultActions'
import styles from '../IncomeTaxTool/IncomeTaxTool.module.css'
import { copyText, resultLines } from '../clipboard'
import { downloadCsv } from '../csv'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { trackEvent } from '../analytics'
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

  const copyResult = async () => {
    try {
      await copyText(resultLines([
        '稿酬个税计算结果',
        `税前收入：${money(income)}`,
        `费用扣除：${money(result.expenseDeduction)}`,
        `扣除费用后：${money(result.incomeAfterExpense)}`,
        `减按 70% 后：${money(result.taxable)}`,
        '预扣率：20%',
        `预扣个税：${money(result.tax)}`,
        `预计到手：${money(result.takeHome)}`,
      ]))
      notify('已复制稿酬计算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动复制结果')
    }
  }
  const exportCsv = () => {
    const rows = [
      ['项目', '金额/结果'],
      ['税前收入', result.income.toFixed(2)],
      ['费用扣除', result.expenseDeduction.toFixed(2)],
      ['扣除费用后', result.incomeAfterExpense.toFixed(2)],
      ['减按 70% 后', result.taxable.toFixed(2)],
      ['预扣率', '20%'],
      ['预扣个税', result.tax.toFixed(2)],
      ['预计到手', result.takeHome.toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'author_tax', rows: rows.length - 1 })
    downloadCsv(`稿酬个税测算-${currentYear}.csv`, rows)
    notify('已导出稿酬测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.eyebrow}><BookOpenText size={18} />{currentYear} 年稿酬个税计算器</div>
        <h1>稿酬收入，<br />扣多少税？</h1>
        <p>输入稿酬税前收入，按居民个人稿酬所得预扣规则估算费用扣除、减按 70%、预扣个税和税后到手金额。</p>
      </div>
      <div className={styles.heroNote}><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className={styles.workspace} aria-label="稿酬个税计算器">
      <form className={`${styles.input} panel`} onSubmit={(event) => event.preventDefault()}>
        <h2>计算稿酬收入</h2>
        <label className={styles.field} htmlFor="authorIncome"><span>稿酬税前收入</span><MoneyInput id="authorIncome" value={income} onChange={setIncome} /></label>
        <p className={styles.formNote}>稿酬所得先按劳务类规则扣除费用，再将收入额减按 70% 计算，通常按 20% 比例预扣。</p>
        <div className={styles.formActions}><Button variant="primary" type="submit">更新计算结果 <ArrowRight size={16} /></Button><Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button></div>
      </form>

      <section className={`${styles.result} panel`} aria-live="polite">
        <div className={styles.resultHeading}><div><span className={styles.sectionTitle}>计算结果</span><p>{currentYear} 年 · 稿酬 {money(income)}</p></div><span className={styles.badge}>居民个人</span></div>
        <div className={styles.takeHome}><span>预计到手</span><strong>{money(result.takeHome)}</strong><p>预扣个税 {money(result.tax)}，适用 20% 比例预扣率。</p></div>
        <MetricGrid items={[{ label: '费用扣除', value: money(result.expenseDeduction) }, { label: '减按 70% 后', value: money(result.taxable) }, { label: '预扣率', value: '20%' }, { label: '预扣个税', value: money(result.tax) }]} />
        <div className={styles.process}>
          <h3>计算过程</h3>
          <dl>
            <div><dt>费用扣除</dt><dd>{income <= 4000 ? `${money(income)} 中扣除 ${money(result.expenseDeduction)}` : `${money(income)} × 20% = ${money(result.expenseDeduction)}`}</dd></div>
            <div><dt>扣除费用后</dt><dd>{money(income)} - {money(result.expenseDeduction)} = {money(result.incomeAfterExpense)}</dd></div>
            <div><dt>减按 70%</dt><dd>{money(result.incomeAfterExpense)} × 70% = {money(result.taxable)}</dd></div>
            <div><dt>预扣个税</dt><dd>{money(result.taxable)} × 20% = {money(result.tax)}</dd></div>
            <div><dt>税后到手</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <ResultActions><ResultActionLink href="/tax-rate">查看税率表 <span>→</span></ResultActionLink><ResultActionButton onClick={exportCsv}><Download size={14} />导出 CSV</ResultActionButton><ResultActionButton onClick={copyResult}><Copy size={14} />复制结果</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions>
      </section>
    </section>

    <section className={styles.explain}><div><h2>稿酬和劳务报酬有什么不同？</h2><p>稿酬所得通常指作品出版、发表取得的收入。和一般劳务报酬相比，稿酬所得收入额按规定减按 70% 计算。</p></div><Link href="/labor-tax">算劳务报酬 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="author" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <Toast message={toast} />
  </>
}
