'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Coins, Copy, Download, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../SiteFooter'
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
import { calculateFlatIncomeTax } from '@/lib/flat-income-tax'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'

export default function DividendTaxClient() {
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
    url.pathname = '/dividend-tax'
    url.search = new URLSearchParams({ income: String(Math.round(income)) }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前利息股息红利计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }

  const copyResult = async () => {
    try {
      await copyText(resultLines([
        '利息股息红利个税计算结果',
        `税前收入：${money(result.income)}`,
        '税率：20%',
        `应缴个税：${money(result.tax)}`,
        `税后收入：${money(result.takeHome)}`,
      ]))
      notify('已复制利息股息红利计算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动复制结果')
    }
  }
  const exportCsv = () => {
    const rows = [
      ['项目', '金额/结果'],
      ['税前收入', result.income.toFixed(2)],
      ['税率', '20%'],
      ['应缴个税', result.tax.toFixed(2)],
      ['税后收入', result.takeHome.toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'dividend_tax', rows: rows.length - 1 })
    downloadCsv(`利息股息红利个税测算-${currentYear}.csv`, rows)
    notify('已导出利息股息红利测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.eyebrow}><Coins size={18} />{currentYear} 年利息股息红利个税计算器</div>
        <h1>分红利息，<br />扣多少税？</h1>
        <p>输入利息、股息或红利收入，按 20% 比例税率估算应缴个人所得税和税后收入。</p>
      </div>
      <div className={styles.heroNote}><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className={styles.workspace} aria-label="利息股息红利个税计算器">
      <form className={`${styles.input} panel`} onSubmit={(event) => event.preventDefault()}>
        <h2>计算利息股息红利</h2>
        <label className={styles.field} htmlFor="dividendIncome"><span>本次税前收入</span><MoneyInput id="dividendIncome" value={income} onChange={setIncome} /></label>
        <p className={styles.formNote}>利息、股息、红利所得通常以每次取得收入为一次，按 20% 比例税率计算，由扣缴义务人按规定代扣代缴。</p>
        <div className={styles.formActions}><button className="primary-button" type="submit">更新计算结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div>
      </form>

      <section className={`${styles.result} panel`} aria-live="polite">
        <div className={styles.resultHeading}><div><span className={styles.sectionTitle}>计算结果</span><p>{currentYear} 年 · 税前收入 {money(income)}</p></div><span className={styles.badge}>20% 税率</span></div>
        <div className={styles.takeHome}><span>预计税后收入</span><strong>{money(result.takeHome)}</strong><p>应缴个税 {money(result.tax)}。</p></div>
        <MetricGrid items={[{ label: '税前收入', value: money(result.income) }, { label: '税率', value: '20%' }, { label: '应缴个税', value: money(result.tax) }, { label: '税后收入', value: money(result.takeHome) }]} />
        <div className={styles.process}>
          <h3>计算过程</h3>
          <dl>
            <div><dt>应缴个税</dt><dd>{money(income)} × 20% = {money(result.tax)}</dd></div>
            <div><dt>税后收入</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <ResultActions><ResultActionLink href="/tax-rate">查看税率表 <span>→</span></ResultActionLink><ResultActionButton onClick={exportCsv}><Download size={14} />导出 CSV</ResultActionButton><ResultActionButton onClick={copyResult}><Copy size={14} />复制结果</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions>
      </section>
    </section>

    <section className={styles.explain}><div><h2>这类所得有什么特点？</h2><p>利息、股息、红利所得不并入综合所得，通常按次用 20% 比例税率计算。不同金融产品可能存在免税或特殊口径，需要结合具体收入性质核对。</p></div><Link href="/tax-rate">看分类所得税率 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="dividend" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>
}
