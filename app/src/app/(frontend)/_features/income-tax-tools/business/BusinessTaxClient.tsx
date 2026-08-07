'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Briefcase, Copy, Download, ReceiptText, RotateCcw } from 'lucide-react'
import SiteFooter from '../../../_components/SiteFooter'
import { Button } from '../../../_components/Button'
import Toast from '../../../_components/Toast'
import SiteHeader from '../../../_components/SiteHeader'
import MoneyInput from '../../../_components/MoneyInput'
import Panel from '../../../_components/Panel'
import MetricGrid from '../../../_components/MetricGrid'
import RuleSourcePanel from '../../../_components/RuleSourcePanel'
import LongTailInfo from '../../../_components/LongTailInfo'
import ResultActions, { ResultActionButton, ResultActionLink } from '../../../_components/ResultActions/ResultActions'
import styles from '../IncomeTaxTool/IncomeTaxTool.module.css'
import { copyText, resultLines } from '../../../_lib/clipboard'
import { downloadCsv } from '../../../_lib/csv'
import { useMoneyFormat } from '../../../_components/MoneyFormatProvider'
import { trackEvent } from '../../../_lib/analytics'
import { businessTaxBrackets, calculateBusinessTax } from '@/lib/business-tax'
import { getIncomeTaxRuleWarning, getIncomeTaxTableBrackets, type IncomeTaxCalculatorRuleProps } from '@/lib/income-tax-calculator-rules'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'
import RuleBoundaryNotice from '../../../_components/RuleBoundaryNotice'

export default function BusinessTaxClient({ taxRateRule, taxRateYear = currentYear }: IncomeTaxCalculatorRuleProps) {
  const { money } = useMoneyFormat()
  const [revenue, setRevenue] = useState(200000)
  const [costsAndExpenses, setCostsAndExpenses] = useState(80000)
  const [losses, setLosses] = useState(10000)
  const [otherDeductions, setOtherDeductions] = useState(0)
  const [toast, setToast] = useState('')
  const brackets = getIncomeTaxTableBrackets(taxRateRule, businessTaxBrackets)
  const result = useMemo(() => calculateBusinessTax({ revenue, costsAndExpenses, losses, otherDeductions }, brackets), [revenue, costsAndExpenses, losses, otherDeductions, brackets])
  const rate = Math.round(result.bracket.rate * 100)
  const ruleWarningMessages = getIncomeTaxRuleWarning(taxRateRule, 'table', taxRateYear, '经营所得')

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedRevenue = parseAmountParam(params.get('revenue'))
    const requestedCosts = parseAmountParam(params.get('costs'))
    const requestedLosses = parseAmountParam(params.get('losses'))
    const requestedOther = parseAmountParam(params.get('other'))
    if (requestedRevenue > 0) setRevenue(requestedRevenue)
    if (requestedCosts >= 0) setCostsAndExpenses(requestedCosts)
    if (requestedLosses >= 0) setLosses(requestedLosses)
    if (requestedOther >= 0) setOtherDeductions(requestedOther)
  }, [])

  const reset = () => {
    setRevenue(200000)
    setCostsAndExpenses(80000)
    setLosses(10000)
    setOtherDeductions(0)
  }

  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/business-tax'
    url.search = new URLSearchParams({
      revenue: String(Math.round(revenue)),
      costs: String(Math.round(costsAndExpenses)),
      losses: String(Math.round(losses)),
      other: String(Math.round(otherDeductions)),
    }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前经营所得计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }

  const copyResult = async () => {
    try {
      await copyText(resultLines([
        '经营所得个税计算结果',
        `年度收入总额：${money(revenue)}`,
        `成本、费用：${money(costsAndExpenses)}`,
        `经营损失：${money(losses)}`,
        `其他可扣除金额：${money(otherDeductions)}`,
        `总扣除：${money(result.totalDeduction)}`,
        `应纳税所得额：${money(result.taxable)}`,
        `税率：${rate}%`,
        `速算扣除数：${money(result.bracket.quick)}`,
        `应缴个税：${money(result.tax)}`,
        `预计税后经营收入：${money(result.afterTax)}`,
      ]))
      notify('已复制经营所得计算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动复制结果')
    }
  }
  const exportCsv = () => {
    const rows = [
      ['项目', '金额/结果'],
      ['年度收入总额', result.revenue.toFixed(2)],
      ['成本、费用', result.costsAndExpenses.toFixed(2)],
      ['经营损失', result.losses.toFixed(2)],
      ['其他可扣除金额', result.otherDeductions.toFixed(2)],
      ['总扣除', result.totalDeduction.toFixed(2)],
      ['应纳税所得额', result.taxable.toFixed(2)],
      ['税率', `${rate}%`],
      ['速算扣除数', result.bracket.quick.toFixed(2)],
      ['应缴个税', result.tax.toFixed(2)],
      ['预计税后经营收入', result.afterTax.toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'business_tax', rows: rows.length - 1 })
    downloadCsv(`经营所得个税测算-${currentYear}.csv`, rows)
    notify('已导出经营所得测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className={styles.page}>
    <header className={styles.hero}>
      <div>
        <div className={styles.eyebrow}><Briefcase size={18} />{currentYear} 年经营所得个税计算器</div>
        <h1>经营收入，<br />个税多少？</h1>
        <p>输入年度收入总额、成本费用和损失，按经营所得五级超额累进税率估算年度个人所得税。</p>
      </div>
      <div className={styles.heroNote}><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <RuleBoundaryNotice messages={ruleWarningMessages} title="税率规则来源提示" />
    <section className={styles.workspace} aria-label="经营所得个税计算器">
      <Panel as="form" className={styles.input} onSubmit={(event) => event.preventDefault()}>
        <h2>计算经营所得</h2>
        <label className={styles.field} htmlFor="businessRevenue"><span>年度收入总额</span><MoneyInput id="businessRevenue" value={revenue} onChange={setRevenue} /></label>
        <label className={styles.field} htmlFor="businessCosts"><span>成本、费用</span><MoneyInput id="businessCosts" value={costsAndExpenses} onChange={setCostsAndExpenses} /></label>
        <label className={styles.field} htmlFor="businessLosses"><span>经营损失</span><MoneyInput id="businessLosses" value={losses} onChange={setLosses} /></label>
        <label className={styles.field} htmlFor="businessOther"><span>其他可扣除金额</span><MoneyInput id="businessOther" value={otherDeductions} onChange={setOtherDeductions} /></label>
        <p className={styles.formNote}>适合个体工商户、个人独资企业投资人、合伙企业个人合伙人等做年度粗算。查账、核定征收和投资者扣除口径可能不同。</p>
        <div className={styles.formActions}><Button variant="primary" type="submit">更新计算结果 <ArrowRight size={16} /></Button><Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button></div>
      </Panel>

      <Panel as="section" className={styles.result} aria-live="polite">
        <div className={styles.resultHeading}><div><span className={styles.sectionTitle}>计算结果</span><p>{currentYear} 年 · 经营收入 {money(revenue)}</p></div><span className={styles.badge}>{rate}% 档</span></div>
        <div className={styles.takeHome}><span>预计税后经营收入</span><strong>{money(result.afterTax)}</strong><p>应缴个税 {money(result.tax)}，适用税率 {rate}%。</p></div>
        <MetricGrid items={[{ label: '总扣除', value: money(result.totalDeduction) }, { label: '应纳税所得额', value: money(result.taxable) }, { label: '税率', value: `${rate}%` }, { label: '速算扣除数', value: money(result.bracket.quick) }]} />
        <div className={styles.process}>
          <h3>计算过程</h3>
          <dl>
            <div><dt>应纳税所得额</dt><dd>{money(revenue)} - {money(result.totalDeduction)} = {money(result.taxable)}</dd></div>
            <div><dt>应缴个税</dt><dd>{money(result.taxable)} × {rate}% - {money(result.bracket.quick)} = {money(result.tax)}</dd></div>
            <div><dt>税后经营收入</dt><dd>{money(revenue)} - {money(result.tax)} = {money(result.afterTax)}</dd></div>
          </dl>
        </div>
        <ResultActions><ResultActionLink href="/tax-rate">查看税率表 <span>→</span></ResultActionLink><ResultActionButton onClick={exportCsv}><Download size={14} />导出 CSV</ResultActionButton><ResultActionButton onClick={copyResult}><Copy size={14} />复制结果</ResultActionButton><ResultActionButton onClick={copyShareLink}><Copy size={14} />复制链接</ResultActionButton></ResultActions>
      </Panel>
    </section>

    <section className={styles.explain}><div><h2>经营所得怎么算？</h2><p>经营所得通常按纳税年度收入总额，减除成本、费用以及损失后的余额计算，再套用 5% 至 35% 的五级超额累进税率。</p></div><Link href="/tax-rate">看经营所得税率 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="business" />
    <RuleSourcePanel checkedAt={taxRateRule?.checkedAt || ruleCheckedDate} />
    <SiteFooter />
  </main></div>
  <Toast message={toast} />
  </>
}
