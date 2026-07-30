'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ClipboardCheck, Info, RotateCcw } from 'lucide-react'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import MoneyInput from '../MoneyInput'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { currentYear } from '@/lib/site'
import { specialDeductionGroups, specialDeductionItems, sumSpecialDeductions } from '@/lib/special-deductions'

type Mode = 'items' | 'manual'

export default function SpecialDeductionsClient() {
  const { money } = useMoneyFormat()
  const [mode, setMode] = useState<Mode>('items')
  const [manualAmount, setManualAmount] = useState(3000)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['children'])
  const itemAmount = sumSpecialDeductions(selections)
  const monthAmount = mode === 'manual' ? manualAmount : itemAmount
  const selectedItems = useMemo(() => Object.values(selections).map((id) => specialDeductionItems.find((item) => item.id === id)).filter(Boolean), [selections])

  const toggleGroup = (group: string) => setExpandedGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group])
  const selectOption = (group: string, option: string) => setSelections((current) => {
    const next = { ...current }
    if (next[group] === option) delete next[group]
    else next[group] = option
    return next
  })
  const reset = () => { setManualAmount(0); setSelections({}); setExpandedGroups(['children']); setMode('items') }

  return <div className="app-shell">
    <SiteHeader active="special-deductions" />
    <main className="special-page">
      <header className="special-hero">
        <div>
          <p className="eyebrow">{currentYear} 年专项附加扣除计算器</p>
          <h1>哪些支出，可以少缴个税？</h1>
          <p>直接输入扣除总额，或按项目选择子女教育、住房租金、赡养老人等扣除口径，计算本月和全年可扣金额。</p>
        </div>
        <div className="special-total-card">
          <span>本月专项附加扣除</span>
          <strong>{money(monthAmount)}</strong>
          <small>全年约 {money(monthAmount * 12)}</small>
        </div>
      </header>

      <section className="special-workspace" aria-label="专项附加扣除计算器">
        <section className="special-input panel">
          <div className="special-mode-tabs" role="tablist" aria-label="计算方式">
            <button className={mode === 'items' ? 'active' : ''} type="button" onClick={() => setMode('items')}>按项目计算</button>
            <button className={mode === 'manual' ? 'active' : ''} type="button" onClick={() => setMode('manual')}>直接输入总额</button>
          </div>

          {mode === 'manual' ? <div className="special-manual">
            <label className="bonus-field" htmlFor="manualDeduction"><span>本月专项附加扣除总额</span><MoneyInput id="manualDeduction" value={manualAmount} onChange={setManualAmount} /></label>
            <p>如果你已经在个税 APP 或工资条里看到扣除总额，可以直接填写这里。</p>
          </div> : <div className="special-groups">
            {specialDeductionGroups.map((group) => {
              const selectedOption = specialDeductionItems.find((item) => item.id === selections[group.key])
              const expanded = expandedGroups.includes(group.key)
              return <div className={`deduction-group${group.options.length === 0 ? ' disabled' : ''}`} key={group.key}>
                <button className="deduction-group-heading" type="button" onClick={() => toggleGroup(group.key)} aria-expanded={expanded}>
                  <span className={`deduction-group-status${selectedOption ? ' selected' : ''}`} aria-hidden="true" />
                  <span><strong>{group.title}{selectedOption && <b>{money(selectedOption.amount)} / 月</b>}</strong><small>{group.note}</small></span>
                  <ChevronDown size={16} />
                </button>
                {expanded && (group.options.length > 0 ? <div className="deduction-option-grid">
                  {group.options.map((item) => <label className={`deduction-option${selections[group.key] === item.id ? ' selected' : ''}`} key={item.id}>
                    <input type="checkbox" checked={selections[group.key] === item.id} onChange={() => selectOption(group.key, item.id)} />
                    <span>{item.label}</span>
                    <b>{money(item.amount)} / 月</b>
                  </label>)}
                </div> : <p>大病医疗通常在年度汇算时按实际发生额扣除，暂不参与本月工资预扣计算。</p>)}
              </div>
            })}
          </div>}
        </section>

        <aside className="special-result panel">
          <div className="special-result-heading"><ClipboardCheck size={18} /><span>计算结果</span></div>
          <div className="special-result-number"><span>本月可扣除</span><strong>{money(monthAmount)}</strong></div>
          <dl>
            <div><dt>全年可扣除</dt><dd>{money(monthAmount * 12)}</dd></div>
            <div><dt>计算方式</dt><dd>{mode === 'manual' ? '直接输入' : '按项目计算'}</dd></div>
            <div><dt>已选项目</dt><dd>{mode === 'manual' ? '-' : `${selectedItems.length} 项`}</dd></div>
          </dl>
          {mode === 'items' && selectedItems.length > 0 && <div className="special-selected-list">
            {selectedItems.map((item) => item && <div key={item.id}><span>{item.group}</span><strong>{item.label}</strong><b>{money(item.amount)} / 月</b></div>)}
          </div>}
          <div className="special-actions">
            <Link className="primary-button" href={`/calculator#deduction`}>去工资计算器使用 <ArrowRight size={16} /></Link>
            <button className="secondary-button" type="button" onClick={reset}><RotateCcw size={15} />重置</button>
          </div>
          <p className="special-note"><Info size={14} />扣除资格、分摊比例和申报口径以官方规定和个税 APP 为准。</p>
        </aside>
      </section>

      <section className="special-content-grid">
        <article>
          <h2>专项附加扣除怎么影响个税？</h2>
          <p>专项附加扣除会减少累计应纳税所得额。它不是直接少缴同等金额的税，而是根据你所在的预扣率档位影响最终个税。</p>
        </article>
        <article>
          <h2>住房租金和房贷利息能同时扣吗？</h2>
          <p>通常不能。同一纳税年度内，住房贷款利息和住房租金专项附加扣除不能同时享受。</p>
        </article>
        <article>
          <h2>大病医疗为什么不进本月合计？</h2>
          <p>大病医疗通常在年度汇算时按实际发生额扣除，不适合简单折算到每月工资预扣里。</p>
        </article>
      </section>

      <section className="source-section" aria-label="官方来源">
        <div><h2>规则来源</h2><p>专项附加扣除标准参考国务院、国家税务总局公开规则，政策变化后需要更新规则版本。</p></div>
        <div className="source-links"><a href="https://fgk.chinatax.gov.cn/zcfgk/c102440/c5209858/content.html" target="_blank" rel="noreferrer">专项附加扣除暂行办法 ↗</a><a href="https://fgk.chinatax.gov.cn/zcfgk/c102440/c5213594/content.html" target="_blank" rel="noreferrer">提高扣除标准通知 ↗</a></div>
      </section>

      <SiteFooter />
    </main>
  </div>
}
