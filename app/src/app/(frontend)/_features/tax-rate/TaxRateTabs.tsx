'use client'

import { useEffect, useState, type MouseEvent } from 'react'
import { ExternalLink, Info } from 'lucide-react'
import Link from 'next/link'
import { currentYear, ruleCheckedDate } from '@/lib/site'
import { businessTaxBrackets } from '@/lib/business-tax'
import { taxBrackets as fallbackTaxBrackets, type TaxBracket } from '@/lib/tax-rules'
import { getTaxRateLabel, getTaxRatePageSeo, getTaxRateUrl, isClassifiedTaxRateType, parseTaxRateSelection, type TaxRateIdentity, type TaxRateIncomeType, type TaxRateSelection } from '@/lib/tax-rate-page'
import type { IncomeTaxRateRule, IncomeTaxRuleDataset, IncomeTaxYearRules } from '@/lib/income-tax-rule-types'
import styles from './TaxRateTabs.module.css'
import DataTable from '../../_components/DataTable'
import { useMoneyFormat } from '../../_components/MoneyFormatProvider'
import Panel from '../../_components/Panel'
import SelectField from '../../_components/SelectField'
import RuleBoundaryNotice from '../../_components/RuleBoundaryNotice'
import { trackEvent } from '../../_lib/analytics'

type Identity = TaxRateIdentity
type IncomeGroup = 'comprehensive' | 'classified'
type IncomeType = TaxRateIncomeType
type RateRow = { range: string; rate: string; quick: string | number }
type RateTab = { title: string; description: string; rows?: RateRow[]; rate?: string; note: string }

const fallbackSalaryRows = [
  '不超过 36,000 元', '超过 36,000 元至 144,000 元', '超过 144,000 元至 300,000 元', '超过 300,000 元至 420,000 元', '超过 420,000 元至 660,000 元', '超过 660,000 元至 960,000 元', '超过 960,000 元',
].map((range, index) => ({ range, rate: `${Math.round(fallbackTaxBrackets[index].rate * 100)}%`, quick: fallbackTaxBrackets[index].quick }))

const laborRows = [
  { range: '不超过 20,000 元', rate: '20%', quick: '0' },
  { range: '超过 20,000 元至 50,000 元', rate: '30%', quick: '2,000' },
  { range: '超过 50,000 元', rate: '40%', quick: '7,000' },
]

const nonResidentRows = [
  { range: '不超过 3,000 元', rate: '3%', quick: '0' },
  { range: '超过 3,000 元至 12,000 元', rate: '10%', quick: '210' },
  { range: '超过 12,000 元至 25,000 元', rate: '20%', quick: '1,410' },
  { range: '超过 25,000 元至 35,000 元', rate: '25%', quick: '2,660' },
  { range: '超过 35,000 元至 55,000 元', rate: '30%', quick: '4,410' },
  { range: '超过 55,000 元至 80,000 元', rate: '35%', quick: '7,160' },
  { range: '超过 80,000 元', rate: '45%', quick: '15,160' },
]

const businessRows = [
  '不超过 30,000 元',
  '超过 30,000 元至 90,000 元',
  '超过 90,000 元至 300,000 元',
  '超过 300,000 元至 500,000 元',
  '超过 500,000 元',
].map((range, index) => ({ range, rate: `${Math.round(businessTaxBrackets[index].rate * 100)}%`, quick: businessTaxBrackets[index].quick }))

const incomeGroups: { label: string; items: { id: IncomeType; label: string }[] }[] = [
  { label: '综合所得', items: [{ id: 'salary', label: '工资薪金' }, { id: 'labor', label: '劳务报酬' }, { id: 'royalty', label: '稿酬' }, { id: 'license', label: '特许权使用费' }] },
  { label: '分类所得', items: [{ id: 'business', label: '经营所得' }, { id: 'rent', label: '财产租赁' }, { id: 'transfer', label: '财产转让' }, { id: 'dividend', label: '利息、股息、红利' }, { id: 'accidental', label: '偶然所得' }] },
]

const calculatorLinks: Record<IncomeType, { href: string; label: string }> = {
  salary: { href: '/calculator', label: '用工资计算器测算' },
  labor: { href: '/labor-tax', label: '计算劳务报酬个税' },
  royalty: { href: '/author-tax', label: '计算稿酬个税' },
  license: { href: '/license-tax', label: '计算特许权使用费' },
  business: { href: '/business-tax', label: '计算经营所得个税' },
  rent: { href: '/rental-tax', label: '计算财产租赁个税' },
  transfer: { href: '/property-transfer-tax', label: '计算财产转让个税' },
  dividend: { href: '/dividend-tax', label: '计算利息股息红利个税' },
  accidental: { href: '/accidental-tax', label: '计算偶然所得个税' },
}

function getBracketRows(brackets: TaxBracket[], fallbackRows: RateRow[]) {
  return brackets.map((bracket, index) => ({
    range: bracket.rangeLabel || fallbackRows[index]?.range || '按规则区间',
    rate: `${Math.round(bracket.rate * 100)}%`,
    quick: bracket.quick,
  }))
}

function getSalaryRows(brackets: TaxBracket[]) {
  return getBracketRows(brackets, fallbackSalaryRows)
}

const incomeTypeByUiType: Record<IncomeType, IncomeTaxRateRule['incomeType']> = {
  salary: 'salary',
  labor: 'labor',
  royalty: 'author',
  license: 'license',
  business: 'business',
  rent: 'rental',
  transfer: 'transfer',
  dividend: 'dividend',
  accidental: 'accidental',
}

function getTaxRateRule(taxRates: IncomeTaxRateRule[], identity: Identity, type: IncomeType) {
  const taxpayerIdentity: IncomeTaxRateRule['taxpayerIdentity'] = isClassifiedTaxRateType(type)
    ? 'notApplicable'
    : identity === 'non-resident'
      ? 'nonResident'
      : 'resident'
  return taxRates.find((rule) => rule.incomeType === incomeTypeByUiType[type] && rule.taxpayerIdentity === taxpayerIdentity)
}

function getRateTab(identity: Identity, type: IncomeType, salaryRows: RateRow[], taxRates: IncomeTaxRateRule[]): RateTab {
  const nonResident = identity === 'non-resident'
  const classified = isClassifiedTaxRateType(type)
  const identityLabel = classified ? '' : nonResident ? '非居民个人' : '居民个人'
  const rule = getTaxRateRule(taxRates, identity, type)
  const fallbackRows = type === 'salary'
    ? (nonResident ? nonResidentRows : salaryRows)
    : type === 'labor'
      ? (nonResident ? nonResidentRows : laborRows)
      : type === 'business'
        ? businessRows
        : salaryRows
  const tableRows = rule?.rateMode === 'table' ? getBracketRows(rule.brackets, fallbackRows) : fallbackRows
  const flatRate = `${Math.round((rule?.flatRate ?? 0.2) * 100)}% 比例税率`

  // 税率页优先展示 CMS 规则；CMS 尚未发布时继续使用页面内置参考值，并由上方提示告知用户。
  if (type === 'salary') return { title: `${identityLabel}工资薪金${nonResident ? '税率表' : '预扣率表一'}`, description: `${identityLabel}工资、薪金所得适用`, rows: tableRows, note: nonResident ? '非居民个人工资、薪金所得按月计算，不使用居民个人工资薪金的累计预扣法。' : '工资薪金采用累计预扣法，每月根据累计收入、累计扣除和已预扣税额计算本月应预扣税额。' }
  if (type === 'labor') return { title: `${identityLabel}劳务报酬${nonResident ? '税率表' : '预扣率表二'}`, description: `${identityLabel}劳务报酬所得适用`, rows: tableRows, note: nonResident ? '非居民个人劳务报酬通常按次或按月代扣代缴，适用非居民个人税率表。' : '居民个人劳务报酬通常按次或按月预扣，年度汇算时并入综合所得。' }
  if (type === 'royalty') return { title: `${identityLabel}稿酬所得预扣规则`, description: `${identityLabel}稿酬所得适用`, rate: flatRate, note: '稿酬所得收入额按规定减按 70% 计算，通常按次或按月预扣。' }
  if (type === 'license') return { title: `${identityLabel}特许权使用费预扣规则`, description: `${identityLabel}特许权使用费所得适用`, rate: flatRate, note: '特许权使用费通常按次或按月预扣，收入额按规定扣除费用后计算应纳税所得额。' }
  if (type === 'business') return { title: '经营所得税率表', description: '个体工商户、个人独资企业投资人和合伙企业个人合伙人等适用', rows: tableRows, note: '经营所得按纳税年度收入总额减除成本、费用和损失后的余额计算。' }
  if (type === 'rent') return { title: '财产租赁所得税率', description: '出租不动产、机器设备、车船及其他财产取得的所得适用', rate: flatRate, note: '财产租赁所得通常按次或按月计算，按规定扣除相关费用后计算应纳税额。' }
  if (type === 'transfer') return { title: '财产转让所得税率', description: '转让有价证券、股权、不动产及其他财产取得的所得适用', rate: flatRate, note: '财产转让所得按收入额减除财产原值和合理费用后的余额计算。' }
  if (type === 'dividend') return { title: '利息、股息、红利所得税率', description: '取得利息、股息、红利所得适用', rate: flatRate, note: '利息、股息、红利所得通常按次计算个人所得税，有扣缴义务人的由其按规定代扣代缴。' }
  return { title: '偶然所得税率', description: '得奖、中奖、中彩以及其他偶然性质的所得适用', rate: flatRate, note: '偶然所得以每次取得该项所得为一次，通常按次计算个人所得税。' }
}

type TaxRateTabsProps = {
  incomeTaxRules?: IncomeTaxRuleDataset
  initialSelection?: TaxRateSelection
}

export default function TaxRateTabs({ incomeTaxRules, initialSelection }: TaxRateTabsProps) {
  const { money } = useMoneyFormat()
  const availableYears = incomeTaxRules?.availableYears
  const defaultYear = availableYears?.[0] || currentYear
  const defaultSelection: TaxRateSelection = initialSelection || { type: 'salary', identity: 'resident', year: defaultYear }
  const [activeGroup, setActiveGroup] = useState<IncomeGroup>(() => isClassifiedTaxRateType(defaultSelection.type) ? 'classified' : 'comprehensive')
  const [identity, setIdentity] = useState<Identity>(defaultSelection.identity)
  const [activeType, setActiveType] = useState<IncomeType>(defaultSelection.type)
  const [taxYear, setTaxYear] = useState(defaultSelection.year)

  useEffect(() => {
    // 点击 tab 后同步浏览器标题；服务端首屏标题由税率页的 generateMetadata 生成。
    document.title = getTaxRatePageSeo({ type: activeType, identity, year: taxYear }).title
  }, [activeType, identity, taxYear])

  useEffect(() => {
    const handlePopState = () => {
      const nextSelection = parseTaxRateSelection(Object.fromEntries(new URLSearchParams(window.location.search)), availableYears)
      setActiveGroup(isClassifiedTaxRateType(nextSelection.type) ? 'classified' : 'comprehensive')
      setActiveType(nextSelection.type)
      setIdentity(nextSelection.identity)
      setTaxYear(nextSelection.year)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [availableYears])

  const pushSelectionUrl = (selection: TaxRateSelection) => {
    // 使用 pushState 保留浏览器前进/后退能力，同时不触发整页刷新和重复请求 CMS。
    window.history.pushState({}, '', getTaxRateUrl(selection, defaultYear))
  }

  const yearRules: IncomeTaxYearRules = incomeTaxRules?.rulesByYear[String(taxYear)] || {
    year: taxYear,
    taxBrackets: fallbackTaxBrackets,
    taxRates: [],
    specialDeductionGroups: [],
    specialDeductionItems: [],
    taxRateAvailable: false,
    taxRateWarnings: [],
    specialDeductionAvailable: false,
    source: 'unavailable',
    missingReasons: [`${taxYear} 年税率规则尚未加载。`],
  }
  const activeRule = getTaxRateRule(yearRules.taxRates, identity, activeType)
  const active = getRateTab(identity, activeType, getSalaryRows(yearRules.taxBrackets), yearRules.taxRates)
  const activeRuleWarning = activeRule ? [] : [`${taxYear} 年${getTaxRateLabel({ type: activeType, identity })}规则尚未在 CMS 中发布，当前显示内置参考值。`]
  const boundaryMessages = [...(activeType === 'salary' ? yearRules.missingReasons : []), ...activeRuleWarning]
  const activeCheckedAt = activeRule?.checkedAt || yearRules.checkedAt || ruleCheckedDate
  const calculatorLink = calculatorLinks[activeType]
  const currentGroup = incomeGroups.find((group) => group.label === (activeGroup === 'comprehensive' ? '综合所得' : '分类所得')) || incomeGroups[0]
  const selectGroup = (group: IncomeGroup) => {
    const nextType = group === 'comprehensive' ? 'salary' : 'business'
    const nextIdentity = isClassifiedTaxRateType(nextType) ? 'resident' : identity
    setActiveGroup(group)
    setActiveType(nextType)
    setIdentity(nextIdentity)
    pushSelectionUrl({ type: nextType, identity: nextIdentity, year: taxYear })
    trackEvent('tax_rate_tab_change', { level: 'group', group, type: nextType, identity: nextIdentity })
  }
  const selectType = (type: IncomeType) => {
    const nextIdentity = isClassifiedTaxRateType(type) ? 'resident' : identity
    setActiveType(type)
    setIdentity(nextIdentity)
    pushSelectionUrl({ type, identity: nextIdentity, year: taxYear })
    trackEvent('tax_rate_tab_change', { level: 'type', group: activeGroup, type, identity: nextIdentity })
  }
  const selectIdentity = (nextIdentity: Identity) => {
    if (isClassifiedTaxRateType(activeType)) return
    setIdentity(nextIdentity)
    pushSelectionUrl({ type: activeType, identity: nextIdentity, year: taxYear })
    trackEvent('tax_rate_tab_change', { level: 'identity', group: activeGroup, type: activeType, identity: nextIdentity })
  }
  const selectYear = (nextYear: number) => {
    setTaxYear(nextYear)
    pushSelectionUrl({ type: activeType, identity, year: nextYear })
  }

  const handleSelectionLinkClick = (event: MouseEvent<HTMLAnchorElement>, onSelect: () => void) => {
    // 普通左键在当前页无刷新切换；新标签页、快捷键打开等行为保留原生链接能力，方便用户和搜索引擎访问。
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onSelect()
  }

  const rateColumns = [{ key: 'level', header: '级数', align: 'left' as const }, { key: 'range', header: '应纳税所得额', align: 'left' as const }, { key: 'rate', header: '税率 / 预扣率', align: 'right' as const }, { key: 'quick', header: '速算扣除数', align: 'right' as const }]
  const rateRows = active.rows?.map((row, index) => ({
    key: `${activeType}-${identity}-${row.range}`,
    cells: {
      level: index + 1,
      range: row.range,
      rate: { content: row.rate, tone: 'strong' as const },
      quick: { content: formatQuick(row.quick, money), tone: 'strong' as const },
    },
  })) ?? []

  return <section className={styles.tabsSection} aria-label="个人所得税税率表">
    <div className={styles.categoryCards} role="tablist" aria-label="所得类型分类">{([{ id: 'comprehensive', label: '综合所得', description: '工资薪金、劳务报酬、稿酬、特许权使用费' }, { id: 'classified', label: '分类所得', description: '经营、财产、利息股息红利和偶然所得' }] as { id: IncomeGroup; label: string; description: string }[]).map((item) => {
      const nextType: IncomeType = item.id === 'comprehensive' ? 'salary' : 'business'
      const nextIdentity = isClassifiedTaxRateType(nextType) ? 'resident' : identity
      const selection = { type: nextType, identity: nextIdentity, year: taxYear }
      return <a key={item.id} href={getTaxRateUrl(selection, defaultYear)} className={activeGroup === item.id ? styles.active : ''} role="tab" aria-selected={activeGroup === item.id} onClick={(event) => handleSelectionLinkClick(event, () => selectGroup(item.id))}><strong>{item.label}</strong><span>{item.description}</span></a>
    })}</div>
    <div className={styles.incomeNav} aria-label={currentGroup.label}><div className={styles.incomeGroup}><div className={styles.incomeOptions} role="tablist" aria-label={currentGroup.label}>{currentGroup.items.map((item) => {
      const nextIdentity = isClassifiedTaxRateType(item.id) ? 'resident' : identity
      const selection = { type: item.id, identity: nextIdentity, year: taxYear }
      return <a key={item.id} href={getTaxRateUrl(selection, defaultYear)} className={activeType === item.id ? styles.active : ''} role="tab" aria-selected={activeType === item.id} onClick={(event) => handleSelectionLinkClick(event, () => selectType(item.id))}>{item.label}</a>
    })}</div></div></div>
    {activeGroup === 'comprehensive' && <div className={styles.identityNav} role="tablist" aria-label="居民或非居民个人"><div className={styles.identityOptions}>{([{ id: 'resident', label: '居民个人' }, { id: 'non-resident', label: '非居民个人' }] as { id: Identity; label: string }[]).map((item) => {
      const selection = { type: activeType, identity: item.id, year: taxYear }
      return <a key={item.id} href={getTaxRateUrl(selection, defaultYear)} className={identity === item.id ? styles.active : ''} role="tab" aria-selected={identity === item.id} onClick={(event) => handleSelectionLinkClick(event, () => selectIdentity(item.id))}>{item.label}</a>
    })}</div></div>}
    <Panel className={styles.tabPanel} role="tabpanel"><div className={styles.tableHeading}><div><h2>{active.title}</h2><p>{active.description}</p></div><div><SelectField className={styles.yearLabel} label="纳税年度" value={taxYear} onChange={selectYear} options={(incomeTaxRules?.availableYears || [currentYear]).map((year) => ({ value: year, label: `${year} 年` }))} /></div></div><RuleBoundaryNotice messages={boundaryMessages} title="当前年度规则待补充" tone={activeType === 'salary' ? 'error' : 'warning'} />{active.rows ? <DataTable ariaLabel={active.title} columns={rateColumns} rows={rateRows} headerTone="muted" wrapperClassName={styles.tableWrap} tableClassName={styles.table} /> : <div className={styles.simpleRatePanel}><div className={styles.simpleRateCopy}><strong>{active.rate}</strong><p>{active.note}</p></div></div>}{active.rows && <div className={styles.tabNote}><Info size={15} /><span>{active.note}</span></div>}<div className={styles.sourceLine}><span>来源：CMS 所得税率规则（未发布时显示内置参考值）；规则核对日期：{activeCheckedAt}</span><a href="https://fgk.chinatax.gov.cn/zcfgk/c100012/c5194838/content.html" target="_blank" rel="noreferrer">查看个人所得税法 <ExternalLink size={13} /></a></div></Panel>
    <section className={styles.nextCard}><div><h2>看完税率表，直接测算</h2><p>税率只决定计算口径，实际结果还要结合收入、扣除、成本或费用。</p></div><Link href={calculatorLink.href}>{calculatorLink.label} <ExternalLink size={13} /></Link></section>
  </section>
}

function formatQuick(value: string | number, money: (value: number, decimals?: number) => string) {
  if (typeof value === 'number') return money(value, 0).replace('¥', '')
  const numeric = Number(value.replaceAll(',', ''))
  return Number.isFinite(numeric) ? money(numeric, 0).replace('¥', '') : value
}
