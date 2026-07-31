'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Copy, Dice5, Download, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../_components/SiteFooter'
import { Button } from '../_components/Button'
import Toast from '../_components/Toast'
import SiteHeader from '../_components/SiteHeader'
import MoneyInput from '../_components/MoneyInput'
import Panel from '../_components/Panel'
import MetricGrid from '../_components/MetricGrid'
import RuleSourcePanel from '../_components/RuleSourcePanel'
import LongTailInfo from '../_components/LongTailInfo'
import ResultActions, { ResultActionButton, ResultActionLink } from '../_components/ResultActions/ResultActions'
import styles from '../_features/income-tax-tools/IncomeTaxTool/IncomeTaxTool.module.css'
import { copyText, resultLines } from '../_lib/clipboard'
import { downloadCsv } from '../_lib/csv'
import { useMoneyFormat } from '../_components/MoneyFormatProvider'
import { trackEvent } from '../_lib/analytics'
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
  const exportCsv = () => {
    const rows = [
      ['项目', '金额/结果'],
      ['税前收入', result.income.toFixed(2)],
      ['税率', '20%'],
      ['应缴个税', result.tax.toFixed(2)],
      ['税后收入', result.takeHome.toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'accidental_tax', rows: rows.length - 1 })
    downloadCsv(`偶然所得个税测算-${currentYear}.csv`, rows)
    notify('已导出偶然所得测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.eyebrow}><Dice5 size={18} />{currentYear} 年偶然所得个税计算器</div>
        <h1>中奖得奖，<br />到手多少？</h1>
        <p>输入中奖、得奖、中彩等偶然所得税前收入，按 20% 比例税率估算应缴个税和税后收入。</p>
      </div>
      <div className={styles.heroNote}><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className={styles.workspace} aria-label="偶然所得个税计算器">
      <Panel as="form" className={styles.input} onSubmit={(event) => event.preventDefault()}>
        <h2>计算偶然所得</h2>
        <label className={styles.field} htmlFor="accidentalIncome"><span>本次税前收入</span><MoneyInput id="accidentalIncome" value={income} onChange={setIncome} /></label>
        <p className={styles.formNote}>偶然所得以每次取得该项收入为一次，通常直接按 20% 比例税率计算个人所得税。</p>
        <div className={styles.formActions}><Button variant="primary" type="submit">更新计算结果 <ArrowRight size={16} /></Button><Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button></div>
      </Panel>

      <Panel as="section" className={styles.result} aria-live="polite">
        <div className={styles.resultHeading}><div><span className={styles.sectionTitle}>计算结果</span><p>{currentYear} 年 · 偶然所得 {money(income)}</p></div><span className={styles.badge}>20% 税率</span></div>
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
      </Panel>
    </section>

    <section className={styles.explain}><div><h2>偶然所得怎么扣？</h2><p>偶然所得通常不扣除费用，以每次收入额作为应纳税所得额，按 20% 比例税率计算个人所得税。</p></div><Link href="/dividend-tax">算利息股息红利 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="accidental" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <Toast message={toast} />
  </>
}
