'use client'

import { useState } from 'react'
import { ExternalLink, Info } from 'lucide-react'
import { currentYear } from '@/lib/site'
import { taxBrackets } from '@/lib/tax-rules'
import { useMoneyFormat } from '../MoneyFormatProvider'

type Identity = 'resident' | 'non-resident'
type IncomeGroup = 'comprehensive' | 'classified'
type IncomeType = 'salary' | 'labor' | 'royalty' | 'license' | 'business' | 'rent' | 'transfer' | 'dividend' | 'accidental'
type RateRow = { range: string; rate: string; quick: string | number }
type RateTab = { title: string; description: string; rows?: RateRow[]; rate?: string; note: string }

const salaryRows = [
  '不超过 36,000 元', '超过 36,000 元至 144,000 元', '超过 144,000 元至 300,000 元', '超过 300,000 元至 420,000 元', '超过 420,000 元至 660,000 元', '超过 660,000 元至 960,000 元', '超过 960,000 元',
].map((range, index) => ({ range, rate: `${Math.round(taxBrackets[index].rate * 100)}%`, quick: taxBrackets[index].quick }))

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

const incomeGroups: { label: string; items: { id: IncomeType; label: string }[] }[] = [
  { label: '综合所得', items: [{ id: 'salary', label: '工资薪金' }, { id: 'labor', label: '劳务报酬' }, { id: 'royalty', label: '稿酬' }, { id: 'license', label: '特许权使用费' }] },
  { label: '分类所得', items: [{ id: 'business', label: '经营所得' }, { id: 'rent', label: '财产租赁' }, { id: 'transfer', label: '财产转让' }, { id: 'dividend', label: '利息、股息、红利' }, { id: 'accidental', label: '偶然所得' }] },
]

function getRateTab(identity: Identity, type: IncomeType): RateTab {
  const nonResident = identity === 'non-resident'
  const classified = ['business', 'rent', 'transfer', 'dividend', 'accidental'].includes(type)
  const identityLabel = classified ? '' : nonResident ? '非居民个人' : '居民个人'
  if (type === 'salary') return { title: `${identityLabel}工资薪金${nonResident ? '税率表' : '预扣率表一'}`, description: `${identityLabel}工资、薪金所得适用`, rows: nonResident ? nonResidentRows : salaryRows, note: nonResident ? '非居民个人工资、薪金所得按月计算，不使用居民个人工资薪金的累计预扣法。' : '工资薪金采用累计预扣法，每月根据累计收入、累计扣除和已预扣税额计算本月应预扣税额。' }
  if (type === 'labor') return { title: `${identityLabel}劳务报酬${nonResident ? '税率表' : '预扣率表二'}`, description: `${identityLabel}劳务报酬所得适用`, rows: nonResident ? nonResidentRows : laborRows, note: nonResident ? '非居民个人劳务报酬通常按次或按月代扣代缴，适用非居民个人税率表。' : '居民个人劳务报酬通常按次或按月预扣，年度汇算时并入综合所得。' }
  if (type === 'royalty') return { title: `${identityLabel}稿酬所得预扣规则`, description: `${identityLabel}稿酬所得适用`, rate: '20% 比例预扣率', note: '稿酬所得收入额按规定减按 70% 计算，通常按次或按月预扣。' }
  if (type === 'license') return { title: `${identityLabel}特许权使用费预扣规则`, description: `${identityLabel}特许权使用费所得适用`, rate: '20% 比例预扣率', note: '特许权使用费通常按次或按月预扣，收入额按规定扣除费用后计算应纳税所得额。' }
  if (type === 'business') return { title: '经营所得税率表', description: '个体工商户、个人独资企业投资人和合伙企业个人合伙人等适用', rate: '5% - 35% 超额累进税率', note: '经营所得按纳税年度收入总额减除成本、费用和损失后的余额计算。' }
  if (type === 'rent') return { title: '财产租赁所得税率', description: '出租不动产、机器设备、车船及其他财产取得的所得适用', rate: '20% 比例税率', note: '财产租赁所得通常按次或按月计算，按规定扣除相关费用后计算应纳税额。' }
  if (type === 'transfer') return { title: '财产转让所得税率', description: '转让有价证券、股权、不动产及其他财产取得的所得适用', rate: '20% 比例税率', note: '财产转让所得按收入额减除财产原值和合理费用后的余额计算。' }
  if (type === 'dividend') return { title: '利息、股息、红利所得税率', description: '取得利息、股息、红利所得适用', rate: '20% 比例税率', note: '利息、股息、红利所得通常按次计算个人所得税，有扣缴义务人的由其按规定代扣代缴。' }
  return { title: '偶然所得税率', description: '得奖、中奖、中彩以及其他偶然性质的所得适用', rate: '20% 比例税率', note: '偶然所得以每次取得该项收入为一次，通常按次计算个人所得税。' }
}

export default function TaxRateTabs() {
  const { money } = useMoneyFormat()
  const [activeGroup, setActiveGroup] = useState<IncomeGroup>('comprehensive')
  const [identity, setIdentity] = useState<Identity>('resident')
  const [activeType, setActiveType] = useState<IncomeType>('salary')
  const active = getRateTab(identity, activeType)
  const currentGroup = incomeGroups.find((group) => group.label === (activeGroup === 'comprehensive' ? '综合所得' : '分类所得')) || incomeGroups[0]

  return <section className="rate-tabs-section" aria-label="个人所得税税率表">
    <div className="rate-category-cards" role="tablist" aria-label="所得类型分类">{([{ id: 'comprehensive', label: '综合所得', description: '工资薪金、劳务报酬、稿酬、特许权使用费' }, { id: 'classified', label: '分类所得', description: '经营、财产、利息股息红利和偶然所得' }] as { id: IncomeGroup; label: string; description: string }[]).map((item) => <button key={item.id} className={activeGroup === item.id ? 'active' : ''} type="button" role="tab" aria-selected={activeGroup === item.id} onClick={() => { setActiveGroup(item.id); setActiveType(item.id === 'comprehensive' ? 'salary' : 'business') }}><strong>{item.label}</strong><span>{item.description}</span></button>)}</div>
    <div className="rate-income-nav" aria-label={currentGroup.label}><div className="rate-income-group"><div className="rate-income-options" role="tablist" aria-label={currentGroup.label}>{currentGroup.items.map((item) => <button key={item.id} className={activeType === item.id ? 'active' : ''} type="button" role="tab" aria-selected={activeType === item.id} onClick={() => setActiveType(item.id)}>{item.label}</button>)}</div></div></div>
    {activeGroup === 'comprehensive' && <div className="rate-identity-nav" role="tablist" aria-label="居民或非居民个人"><div className="rate-identity-options">{([{ id: 'resident', label: '居民个人' }, { id: 'non-resident', label: '非居民个人' }] as { id: Identity; label: string }[]).map((item) => <button key={item.id} className={identity === item.id ? 'active' : ''} type="button" role="tab" aria-selected={identity === item.id} onClick={() => setIdentity(item.id)}>{item.label}</button>)}</div></div>}
    <div className="rate-tab-panel panel" role="tabpanel"><div className="rate-table-heading"><div><h2>{active.title}</h2><p>{active.description}</p></div><span className="rate-year-label">{currentYear} 年</span></div>{active.rows ? <div className="rate-table-wrap"><table className="rate-table"><thead><tr><th>级数</th><th>应纳税所得额</th><th>税率 / 预扣率</th><th>速算扣除数</th></tr></thead><tbody>{active.rows.map((row, index) => <tr key={`${activeType}-${identity}-${row.range}`}><td>{index + 1}</td><td>{row.range}</td><td>{row.rate}</td><td>{formatQuick(row.quick, money)}</td></tr>)}</tbody></table></div> : <div className="simple-rate-panel"><div className="simple-rate-copy"><strong>{active.rate}</strong><p>{active.note}</p></div></div>}{active.rows && <div className="rate-tab-note"><Info size={15} /><span>{active.note}</span></div>}<div className="source-line"><span>规则核对日期：{currentYear}-07-27</span><a href="https://fgk.chinatax.gov.cn/zcfgk/c100012/c5194838/content.html" target="_blank" rel="noreferrer">查看国家税务总局规则 <ExternalLink size={13} /></a></div></div>
  </section>
}

function formatQuick(value: string | number, money: (value: number, decimals?: number) => string) {
  if (typeof value === 'number') return money(value, 0).replace('¥', '')
  const numeric = Number(value.replaceAll(',', ''))
  return Number.isFinite(numeric) ? money(numeric, 0).replace('¥', '') : value
}
