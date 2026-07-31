'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Copy, Download, Home, ReceiptText, RotateCcw } from 'lucide-react'
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
import { copyText, resultLines } from '../clipboard'
import { downloadCsv } from '../csv'
import { useMoneyFormat } from '../_components/MoneyFormatProvider'
import { trackEvent } from '../analytics'
import { calculateRentalTax, type RentalTaxRateMode } from '@/lib/rental-tax'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'

const modes: { value: RentalTaxRateMode; label: string; hint: string }[] = [
  { value: 'housing', label: '出租住房', hint: '按 10% 优惠税率估算' },
  { value: 'general', label: '其他财产', hint: '按 20% 比例税率估算' },
]

export default function RentalTaxClient() {
  const { money } = useMoneyFormat()
  const [income, setIncome] = useState(5000)
  const [taxesAndFees, setTaxesAndFees] = useState(0)
  const [subleaseRent, setSubleaseRent] = useState(0)
  const [repairExpense, setRepairExpense] = useState(0)
  const [mode, setMode] = useState<RentalTaxRateMode>('housing')
  const [toast, setToast] = useState('')
  const result = useMemo(() => calculateRentalTax({ income, taxesAndFees, subleaseRent, repairExpense, mode }), [income, taxesAndFees, subleaseRent, repairExpense, mode])
  const rate = Math.round(result.rate * 100)

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedIncome = parseAmountParam(params.get('income'))
    const requestedTaxes = parseAmountParam(params.get('taxes'))
    const requestedSublease = parseAmountParam(params.get('sublease'))
    const requestedRepair = parseAmountParam(params.get('repair'))
    const requestedMode = params.get('mode')
    if (requestedIncome > 0) setIncome(requestedIncome)
    if (requestedTaxes >= 0) setTaxesAndFees(requestedTaxes)
    if (requestedSublease >= 0) setSubleaseRent(requestedSublease)
    if (requestedRepair >= 0) setRepairExpense(requestedRepair)
    if (requestedMode === 'housing' || requestedMode === 'general') setMode(requestedMode)
  }, [])

  const reset = () => {
    setIncome(5000)
    setTaxesAndFees(0)
    setSubleaseRent(0)
    setRepairExpense(0)
    setMode('housing')
  }

  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/rental-tax'
    url.search = new URLSearchParams({
      income: String(Math.round(income)),
      taxes: String(Math.round(taxesAndFees)),
      sublease: String(Math.round(subleaseRent)),
      repair: String(Math.round(repairExpense)),
      mode,
    }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前财产租赁计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }

  const copyResult = async () => {
    try {
      await copyText(resultLines([
        '财产租赁个税计算结果',
        `租赁类型：${mode === 'housing' ? '出租住房' : '其他财产'}`,
        `每月租赁税前收入：${money(income)}`,
        `出租过程中已缴税费：${money(taxesAndFees)}`,
        `转租支付租金：${money(subleaseRent)}`,
        `本次修缮费用：${money(repairExpense)}`,
        `可扣税费和成本：${money(result.deductibleCosts)}`,
        `应纳税所得额：${money(result.taxable)}`,
        `个税税率：${rate}%`,
        `应缴个税：${money(result.tax)}`,
        `预计税后收入：${money(result.takeHome)}`,
      ]))
      notify('已复制财产租赁计算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动复制结果')
    }
  }
  const exportCsv = () => {
    const rows = [
      ['项目', '金额/结果'],
      ['租赁类型', mode === 'housing' ? '出租住房' : '其他财产'],
      ['每月租赁税前收入', result.income.toFixed(2)],
      ['出租过程中已缴税费', result.taxesAndFees.toFixed(2)],
      ['转租支付租金', result.subleaseRent.toFixed(2)],
      ['本次修缮费用', result.repairExpense.toFixed(2)],
      ['可扣税费和成本', result.deductibleCosts.toFixed(2)],
      ['法定费用扣除', result.statutoryDeduction.toFixed(2)],
      ['应纳税所得额', result.taxable.toFixed(2)],
      ['个税税率', `${rate}%`],
      ['应缴个税', result.tax.toFixed(2)],
      ['预计税后收入', result.takeHome.toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'rental_tax', rows: rows.length - 1 })
    downloadCsv(`财产租赁个税测算-${currentYear}.csv`, rows)
    notify('已导出财产租赁测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.eyebrow}><Home size={18} />{currentYear} 年财产租赁个税计算器</div>
        <h1>出租收入，<br />个税多少？</h1>
        <p>输入每月租金收入、可扣税费、转租租金和修缮费用，估算财产租赁所得个税与税后收入。</p>
      </div>
      <div className={styles.heroNote}><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className={styles.workspace} aria-label="财产租赁个税计算器">
      <Panel as="form" className={styles.input} onSubmit={(event) => event.preventDefault()}>
        <h2>计算财产租赁</h2>
        <div className={styles.rentalModeList} aria-label="租赁类型">
          {modes.map((item) => <button className={`${styles.rentalMode}${mode === item.value ? ` ${styles.active}` : ''}`} type="button" key={item.value} onClick={() => setMode(item.value)}><strong>{item.label}</strong><span>{item.hint}</span></button>)}
        </div>
        <label className={styles.field} htmlFor="rentalIncome"><span>每月租赁税前收入</span><MoneyInput id="rentalIncome" value={income} onChange={setIncome} /></label>
        <label className={styles.field} htmlFor="rentalTaxes"><span>出租过程中已缴税费</span><MoneyInput id="rentalTaxes" value={taxesAndFees} onChange={setTaxesAndFees} /></label>
        <label className={styles.field} htmlFor="rentalSublease"><span>转租支付租金</span><MoneyInput id="rentalSublease" value={subleaseRent} onChange={setSubleaseRent} /></label>
        <label className={styles.field} htmlFor="rentalRepair"><span>本次修缮费用</span><MoneyInput id="rentalRepair" value={repairExpense} onChange={setRepairExpense} /></label>
        <p className={styles.formNote}>修缮费用每次最多扣除 800 元；输入框仅做测算，实际应以有效凭证和当地税务口径为准。</p>
        <div className={styles.formActions}><Button variant="primary" type="submit">更新计算结果 <ArrowRight size={16} /></Button><Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button></div>
      </Panel>

      <Panel as="section" className={styles.result} aria-live="polite">
        <div className={styles.resultHeading}><div><span className={styles.sectionTitle}>计算结果</span><p>{currentYear} 年 · 财产租赁 {money(income)}</p></div><span className={styles.badge}>{mode === 'housing' ? '出租住房' : '其他财产'}</span></div>
        <div className={styles.takeHome}><span>预计税后收入</span><strong>{money(result.takeHome)}</strong><p>应缴个税 {money(result.tax)}，适用 {rate}% 税率。</p></div>
        <MetricGrid items={[{ label: '可扣税费和成本', value: money(result.deductibleCosts) }, { label: '法定费用扣除', value: money(result.statutoryDeduction) }, { label: '应纳税所得额', value: money(result.taxable) }, { label: '个税税率', value: `${rate}%` }]} />
        <div className={styles.process}>
          <h3>计算过程</h3>
          <dl>
            <div><dt>先扣税费成本</dt><dd>{money(income)} - {money(taxesAndFees)} - {money(subleaseRent)} - {money(result.repairDeduction)} = {money(result.incomeAfterCosts)}</dd></div>
            <div><dt>费用扣除</dt><dd>{result.incomeAfterCosts <= 4000 ? `${money(result.incomeAfterCosts)} 中扣除 ${money(result.statutoryDeduction)}` : `${money(result.incomeAfterCosts)} × 20% = ${money(result.statutoryDeduction)}`}</dd></div>
            <div><dt>应纳税所得额</dt><dd>{money(result.incomeAfterCosts)} - {money(result.statutoryDeduction)} = {money(result.taxable)}</dd></div>
            <div><dt>应缴个税</dt><dd>{money(result.taxable)} × {rate}% = {money(result.tax)}</dd></div>
            <div><dt>税后收入</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <ResultActions><ResultActionLink href="/tax-rate">查看税率表 <span>→</span></ResultActionLink><ResultActionButton onClick={exportCsv}><Download size={14} />导出 CSV</ResultActionButton><ResultActionButton onClick={copyResult}><Copy size={14} />复制结果</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions>
      </Panel>
    </section>

    <section className={styles.explain}><div><h2>财产租赁怎么扣？</h2><p>财产租赁所得以一个月内取得的收入为一次。个人出租住房通常可按 10% 优惠税率估算，其他财产租赁按 20% 比例税率估算。</p></div><Link href="/tax-rate">看分类所得税率 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="rental" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <Toast message={toast} />
  </>
}
