'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, Copy, Download, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../_components/SiteFooter'
import { Button } from '../_components/Button'
import Toast from '../_components/Toast'
import SiteHeader from '../_components/SiteHeader'
import MoneyInput from '../_components/MoneyInput'
import Panel from '../_components/Panel'
import RuleSourcePanel from '../_components/RuleSourcePanel'
import LongTailInfo from '../_components/LongTailInfo'
import ResultActions, { ResultActionButton, ResultActionLink } from '../_components/ResultActions/ResultActions'
import styles from '../_features/income-tax-tools/IncomeTaxTool/IncomeTaxTool.module.css'
import MetricGrid from '../_components/MetricGrid'
import { copyText, resultLines } from '../_lib/clipboard'
import { downloadCsv } from '../_lib/csv'
import { useMoneyFormat } from '../_components/MoneyFormatProvider'
import { trackEvent } from '../_lib/analytics'
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
  const exportCsv = () => {
    const rows = [
      ['项目', '金额/结果'],
      ['税前收入', result.income.toFixed(2)],
      ['费用扣除', result.deduction.toFixed(2)],
      ['应纳税所得额', result.taxable.toFixed(2)],
      ['预扣率', `${rate}%`],
      ['速算扣除数', result.bracket.quick.toFixed(2)],
      ['预扣个税', result.tax.toFixed(2)],
      ['预计到手', result.takeHome.toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'labor_tax', rows: rows.length - 1 })
    downloadCsv(`劳务报酬个税测算-${currentYear}.csv`, rows)
    notify('已导出劳务报酬测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.eyebrow}><BriefcaseBusiness size={18} />{currentYear} 年劳务报酬个税计算器</div>
        <h1>劳务报酬，<br />到手多少？</h1>
        <p>输入劳务报酬税前收入，按居民个人劳务报酬预扣规则估算费用扣除、预扣个税和税后到手金额。</p>
      </div>
      <div className={styles.heroNote}><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className={styles.workspace} aria-label="劳务报酬个税计算器">
      <Panel as="form" className={styles.input} onSubmit={(event) => event.preventDefault()}>
        <h2>计算劳务报酬</h2>
        <label className={styles.field} htmlFor="laborIncome"><span>劳务报酬税前收入</span><MoneyInput id="laborIncome" value={income} onChange={setIncome} /></label>
        <p className={styles.formNote}>居民个人劳务报酬通常按次或按月预扣。每次收入不超过 4000 元，费用按 800 元扣除；超过 4000 元，费用按收入 20% 扣除。</p>
        <div className={styles.formActions}><Button variant="primary" type="submit">更新计算结果 <ArrowRight size={16} /></Button><Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button></div>
      </Panel>

      <Panel as="section" className={styles.result} aria-live="polite">
        <div className={styles.resultHeading}><div><span className={styles.sectionTitle}>计算结果</span><p>{currentYear} 年 · 劳务报酬 {money(income)}</p></div><span className={styles.badge}>居民个人</span></div>
        <div className={styles.takeHome}><span>预计到手</span><strong>{money(result.takeHome)}</strong><p>预扣个税 {money(result.tax)}，适用预扣率 {rate}%。</p></div>
        <MetricGrid items={[{ label: '费用扣除', value: money(result.deduction) }, { label: '应纳税所得额', value: money(result.taxable) }, { label: '预扣率', value: `${rate}%` }, { label: '速算扣除数', value: money(result.bracket.quick) }]} />
        <div className={styles.process}>
          <h3>计算过程</h3>
          <dl>
            <div><dt>费用扣除</dt><dd>{income <= 4000 ? `${money(income)} 中扣除 ${money(result.deduction)}` : `${money(income)} × 20% = ${money(result.deduction)}`}</dd></div>
            <div><dt>应纳税所得额</dt><dd>{money(income)} - {money(result.deduction)} = {money(result.taxable)}</dd></div>
            <div><dt>预扣个税</dt><dd>{money(result.taxable)} × {rate}% - {money(result.bracket.quick)} = {money(result.tax)}</dd></div>
            <div><dt>税后到手</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <ResultActions><ResultActionLink href="/tax-rate">查看税率表 <span>→</span></ResultActionLink><ResultActionButton onClick={exportCsv}><Download size={14} />导出 CSV</ResultActionButton><ResultActionButton onClick={copyResult}><Copy size={14} />复制结果</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions>
      </Panel>
    </section>

    <section className={styles.explain}><div><h2>适合哪些收入？</h2><p>常见于独立设计、咨询、讲课、翻译、技术服务等非雇佣性质收入。年度汇算时，居民个人劳务报酬通常会并入综合所得。</p></div><Link href="/calculator">算工资薪金 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="labor" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <Toast message={toast} />
  </>
}
