'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BadgePercent, Copy, Download, ReceiptText, RotateCcw } from 'lucide-react'
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
  const exportCsv = () => {
    const rows = [
      ['项目', '金额/结果'],
      ['税前收入', result.income.toFixed(2)],
      ['费用扣除', result.deduction.toFixed(2)],
      ['应纳税所得额', result.taxable.toFixed(2)],
      ['预扣率', '20%'],
      ['预扣个税', result.tax.toFixed(2)],
      ['预计到手', result.takeHome.toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'license_tax', rows: rows.length - 1 })
    downloadCsv(`特许权使用费个税测算-${currentYear}.csv`, rows)
    notify('已导出特许权使用费测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.eyebrow}><BadgePercent size={18} />{currentYear} 年特许权使用费个税计算器</div>
        <h1>特许权收入，<br />税后多少？</h1>
        <p>输入专利、商标、著作权等特许权使用费税前收入，估算费用扣除、预扣个税和税后到手金额。</p>
      </div>
      <div className={styles.heroNote}><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className={styles.workspace} aria-label="特许权使用费个税计算器">
      <Panel as="form" className={styles.input} onSubmit={(event) => event.preventDefault()}>
        <h2>计算特许权使用费</h2>
        <label className={styles.field} htmlFor="licenseIncome"><span>特许权使用费税前收入</span><MoneyInput id="licenseIncome" value={income} onChange={setIncome} /></label>
        <p className={styles.formNote}>居民个人特许权使用费通常先扣除费用，再按 20% 比例预扣个人所得税。</p>
        <div className={styles.formActions}><Button variant="primary" type="submit">更新计算结果 <ArrowRight size={16} /></Button><Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button></div>
      </Panel>

      <Panel as="section" className={styles.result} aria-live="polite">
        <div className={styles.resultHeading}><div><span className={styles.sectionTitle}>计算结果</span><p>{currentYear} 年 · 特许权使用费 {money(income)}</p></div><span className={styles.badge}>居民个人</span></div>
        <div className={styles.takeHome}><span>预计到手</span><strong>{money(result.takeHome)}</strong><p>预扣个税 {money(result.tax)}，适用 20% 比例预扣率。</p></div>
        <MetricGrid items={[{ label: '费用扣除', value: money(result.deduction) }, { label: '应纳税所得额', value: money(result.taxable) }, { label: '预扣率', value: '20%' }, { label: '预扣个税', value: money(result.tax) }]} />
        <div className={styles.process}>
          <h3>计算过程</h3>
          <dl>
            <div><dt>费用扣除</dt><dd>{income <= 4000 ? `${money(income)} 中扣除 ${money(result.deduction)}` : `${money(income)} × 20% = ${money(result.deduction)}`}</dd></div>
            <div><dt>应纳税所得额</dt><dd>{money(income)} - {money(result.deduction)} = {money(result.taxable)}</dd></div>
            <div><dt>预扣个税</dt><dd>{money(result.taxable)} × 20% = {money(result.tax)}</dd></div>
            <div><dt>税后到手</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <ResultActions><ResultActionLink href="/tax-rate">查看税率表 <span>→</span></ResultActionLink><ResultActionButton onClick={exportCsv}><Download size={14} />导出 CSV</ResultActionButton><ResultActionButton onClick={copyResult}><Copy size={14} />复制结果</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions>
      </Panel>
    </section>

    <section className={styles.explain}><div><h2>和稿酬有什么不同？</h2><p>特许权使用费通常不适用稿酬所得“收入额减按 70%”的规则，适合专利、商标、著作权等使用权收入测算。</p></div><Link href="/author-tax">算稿酬 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="license" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <Toast message={toast} />
  </>
}
