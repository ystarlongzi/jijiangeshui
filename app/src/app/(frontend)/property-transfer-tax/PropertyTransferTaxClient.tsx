'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Copy, Download, ReceiptText, RotateCcw, TrendingUp } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import SiteHeader from '../SiteHeader'
import MoneyInput from '../MoneyInput'
import MetricGrid from '../MetricGrid'
import RuleSourcePanel from '../RuleSourcePanel'
import LongTailInfo from '../LongTailInfo'
import { copyText, resultLines } from '../clipboard'
import { downloadCsv } from '../csv'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { trackEvent } from '../analytics'
import { calculatePropertyTransferTax } from '@/lib/property-transfer-tax'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { parseAmountParam } from '@/lib/url-params'

export default function PropertyTransferTaxClient() {
  const { money } = useMoneyFormat()
  const [income, setIncome] = useState(100000)
  const [originalValue, setOriginalValue] = useState(60000)
  const [reasonableFees, setReasonableFees] = useState(5000)
  const [toast, setToast] = useState('')
  const result = useMemo(() => calculatePropertyTransferTax({ income, originalValue, reasonableFees }), [income, originalValue, reasonableFees])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedIncome = parseAmountParam(params.get('income'))
    const requestedOriginal = parseAmountParam(params.get('original'))
    const requestedFees = parseAmountParam(params.get('fees'))
    if (requestedIncome > 0) setIncome(requestedIncome)
    if (requestedOriginal >= 0) setOriginalValue(requestedOriginal)
    if (requestedFees >= 0) setReasonableFees(requestedFees)
  }, [])

  const reset = () => {
    setIncome(100000)
    setOriginalValue(60000)
    setReasonableFees(5000)
  }

  const copyShareLink = async () => {
    const url = new URL(window.location.href)
    url.pathname = '/property-transfer-tax'
    url.search = new URLSearchParams({
      income: String(Math.round(income)),
      original: String(Math.round(originalValue)),
      fees: String(Math.round(reasonableFees)),
    }).toString()

    try {
      await navigator.clipboard.writeText(url.toString())
      notify('已复制当前财产转让计算链接')
    } catch {
      notify('当前浏览器无法自动复制，请复制地址栏链接')
    }
  }

  const copyResult = async () => {
    try {
      await copyText(resultLines([
        '财产转让个税计算结果',
        `转让收入：${money(result.income)}`,
        `财产原值：${money(result.originalValue)}`,
        `合理费用：${money(result.reasonableFees)}`,
        `应纳税所得额：${money(result.taxable)}`,
        '税率：20%',
        `应缴个税：${money(result.tax)}`,
        `预计税后收入：${money(result.takeHome)}`,
      ]))
      notify('已复制财产转让计算结果')
    } catch {
      notify('当前浏览器无法自动复制，请手动复制结果')
    }
  }
  const exportCsv = () => {
    const rows = [
      ['项目', '金额/结果'],
      ['转让收入', result.income.toFixed(2)],
      ['财产原值', result.originalValue.toFixed(2)],
      ['合理费用', result.reasonableFees.toFixed(2)],
      ['应纳税所得额', result.taxable.toFixed(2)],
      ['税率', '20%'],
      ['应缴个税', result.tax.toFixed(2)],
      ['预计税后收入', result.takeHome.toFixed(2)],
    ]
    trackEvent('export_csv', { calculator: 'property_transfer_tax', rows: rows.length - 1 })
    downloadCsv(`财产转让个税测算-${currentYear}.csv`, rows)
    notify('已导出财产转让测算明细')
  }

  return <>
  <div className="app-shell"><SiteHeader /><main className="labor-page">
    <header className="labor-hero">
      <div>
        <div className="bonus-eyebrow"><TrendingUp size={18} />{currentYear} 年财产转让个税计算器</div>
        <h1>卖出资产，<br />个税多少？</h1>
        <p>输入转让收入、财产原值和合理费用，按财产转让所得 20% 比例税率估算个税和税后收入。</p>
      </div>
      <div className="labor-hero-note"><strong>规则核对日期</strong><span>{ruleCheckedDate}</span></div>
    </header>

    <section className="labor-workspace" aria-label="财产转让个税计算器">
      <form className="labor-input panel" onSubmit={(event) => event.preventDefault()}>
        <h2>计算财产转让</h2>
        <label className="bonus-field" htmlFor="transferIncome"><span>转让收入</span><MoneyInput id="transferIncome" value={income} onChange={setIncome} /></label>
        <label className="bonus-field" htmlFor="transferOriginal"><span>财产原值</span><MoneyInput id="transferOriginal" value={originalValue} onChange={setOriginalValue} /></label>
        <label className="bonus-field" htmlFor="transferFees"><span>合理费用</span><MoneyInput id="transferFees" value={reasonableFees} onChange={setReasonableFees} /></label>
        <p className="bonus-form-note">这里适合做通用测算。房屋、股权等财产转让可能有更细的核定、免税或地方口径，正式申报前需要再核对凭证和政策。</p>
        <div className="bonus-form-actions"><button className="primary-button" type="submit">更新计算结果 <ArrowRight size={16} /></button><button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button></div>
      </form>

      <section className="labor-result panel" aria-live="polite">
        <div className="bonus-result-heading"><div><span className="bonus-section-title">计算结果</span><p>{currentYear} 年 · 财产转让 {money(income)}</p></div><span className="bonus-badge">20% 税率</span></div>
        <div className="labor-takehome"><span>预计税后收入</span><strong>{money(result.takeHome)}</strong><p>应缴个税 {money(result.tax)}，应纳税所得额 {money(result.taxable)}。</p></div>
        <MetricGrid items={[{ label: '转让收入', value: money(result.income) }, { label: '财产原值', value: money(result.originalValue) }, { label: '合理费用', value: money(result.reasonableFees) }, { label: '应纳税所得额', value: money(result.taxable) }]} />
        <div className="labor-process">
          <h3>计算过程</h3>
          <dl>
            <div><dt>应纳税所得额</dt><dd>{money(income)} - {money(originalValue)} - {money(reasonableFees)} = {money(result.taxable)}</dd></div>
            <div><dt>应缴个税</dt><dd>{money(result.taxable)} × 20% = {money(result.tax)}</dd></div>
            <div><dt>税后收入</dt><dd>{money(income)} - {money(result.tax)} = {money(result.takeHome)}</dd></div>
          </dl>
        </div>
        <div className="result-actions"><Link className="link-button" href="/tax-rate">查看税率表 <span>→</span></Link><button className="link-button icon-link-button" type="button" onClick={exportCsv}><Download size={14} />导出 CSV</button><button className="link-button icon-link-button" type="button" onClick={copyResult}><Copy size={14} />复制结果</button><button className="link-button icon-link-button" type="button" onClick={copyShareLink}><Copy size={14} />复制链接</button></div>
      </section>
    </section>

    <section className="bonus-explain"><div><h2>财产转让怎么扣？</h2><p>财产转让所得按一次转让计算，以收入额减除财产原值和合理费用后的余额作为应纳税所得额，再按 20% 计算个税。</p></div><Link href="/rental-tax">算财产租赁 <ReceiptText size={15} /></Link></section>
    <LongTailInfo type="transfer" />
    <RuleSourcePanel />
    <SiteFooter />
  </main></div>
  <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </>
}
