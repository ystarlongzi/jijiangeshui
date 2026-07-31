'use client'

import { useState } from 'react'
import { ArrowRight, ClipboardCheck, Info, RotateCcw } from 'lucide-react'
import SiteHeader from '../SiteHeader'
import SiteFooter from '../SiteFooter'
import { Button, ButtonLink } from '../Button'
import MoneyInput from '../MoneyInput'
import Panel from '../Panel'
import { useMoneyFormat } from '../MoneyFormatProvider'
import SpecialDeductionGroupList from '../SpecialDeductionGroupList'
import useSpecialDeductionSelection from '../useSpecialDeductionSelection'
import RuleSourcePanel from '../RuleSourcePanel'
import styles from './SpecialDeductionsClient.module.css'
import { currentYear } from '@/lib/site'
import { createDeductionHref } from '@/lib/url-params'

type Mode = 'items' | 'manual'

export default function SpecialDeductionsClient() {
  const { money } = useMoneyFormat()
  const [mode, setMode] = useState<Mode>('items')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualAmount, setManualAmount] = useState(0)
  const {
    amount: itemAmount,
    expandedGroups,
    resetSelectionState,
    selectOption,
    selectedItems,
    selections,
    toggleGroup,
  } = useSpecialDeductionSelection({ initialExpandedGroups: ['children'] })
  const monthAmount = mode === 'manual' ? manualAmount : itemAmount

  const selectItemOption = (group: string, option: string) => {
    selectOption(group, option)
    setMode('items')
  }
  const updateManualAmount = (value: number) => {
    setManualAmount(value)
    setMode('manual')
  }
  const reset = () => { setManualAmount(0); setManualOpen(false); resetSelectionState({}, ['children']); setMode('items') }

  return <div className="app-shell">
    <SiteHeader active="special-deductions" />
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{currentYear} 年专项附加扣除计算器</p>
          <h1>哪些支出，可以少缴个税？</h1>
          <p>按项目选择子女教育、住房租金、赡养老人等扣除口径，汇总本月和全年可扣金额。</p>
        </div>
        <div className={styles.totalCard}>
          <span>本月专项附加扣除</span>
          <strong>{money(monthAmount)}</strong>
          <small>全年约 {money(monthAmount * 12)}</small>
        </div>
      </header>

      <section className={styles.workspace} aria-label="专项附加扣除计算器">
        <Panel as="section" className={styles.input}>
          <div className={styles.inputHeading}>
            <div>
              <h2>按项目选择</h2>
              <p>每个项目只选一种扣除方式，再由系统自动汇总月度金额。</p>
            </div>
            <Button className={styles.manualToggle} variant="text" type="button" onClick={() => setManualOpen(!manualOpen)}>{manualOpen ? '收起总额输入' : '已有总额？直接输入'}</Button>
          </div>

          {manualOpen ? <div className={styles.manual}>
            <label className={styles.field} htmlFor="manualDeduction"><span>本月专项附加扣除总额</span><MoneyInput id="manualDeduction" value={manualAmount} onChange={updateManualAmount} /></label>
            <p>如果你已经在个税 APP 或工资条里看到扣除总额，可以直接填写这里。</p>
          </div> : <div className={styles.groups}>
            <SpecialDeductionGroupList
              className={styles.deductionPageList}
              selections={selections}
              expandedGroups={expandedGroups}
              emptyText="大病医疗通常在年度汇算时按实际发生额扣除，暂不参与本月工资预扣计算。"
              onSelect={selectItemOption}
              onToggleGroup={toggleGroup}
            />
          </div>}
        </Panel>

        <Panel as="aside" className={styles.result}>
          <div className={styles.resultHeading}><ClipboardCheck size={18} /><span>计算结果</span></div>
          <div className={styles.resultNumber}><span>本月可扣除</span><strong>{money(monthAmount)}</strong></div>
          <dl>
            <div><dt>全年可扣除</dt><dd>{money(monthAmount * 12)}</dd></div>
            <div><dt>结果来源</dt><dd>{mode === 'manual' ? '直接输入总额' : '按项目汇总'}</dd></div>
            <div><dt>已选项目</dt><dd>{selectedItems.length} 项</dd></div>
          </dl>
          {selectedItems.length > 0 && <div className={styles.selectedList}>
            {selectedItems.map((item) => item && <div key={item.id}><span>{item.group}</span><strong>{item.label}</strong><b>{money(item.amount)} / 月</b></div>)}
          </div>}
          <div className={styles.actions}>
            <ButtonLink variant="primary" href={createDeductionHref('/calculator', monthAmount, '#deduction')}>带入工资计算器 <ArrowRight size={16} /></ButtonLink>
            <ButtonLink variant="secondary" href={createDeductionHref('/reverse-tax', monthAmount)}>带入税后反推 <ArrowRight size={16} /></ButtonLink>
            <Button variant="secondary" type="button" onClick={reset}><RotateCcw size={15} />重置</Button>
          </div>
          <p className={styles.note}><Info size={14} />扣除资格、分摊比例和申报口径以官方规定和个税 APP 为准。</p>
        </Panel>
      </section>

      <section className={styles.contentGrid}>
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

      <RuleSourcePanel
        description="专项附加扣除标准参考国务院、国家税务总局公开规则，政策变化后需要更新规则版本和核对日期。"
        links={[
          { label: '专项附加扣除暂行办法', url: 'https://fgk.chinatax.gov.cn/zcfgk/c102440/c5209858/content.html' },
          { label: '提高扣除标准通知', url: 'https://fgk.chinatax.gov.cn/zcfgk/c102440/c5213594/content.html' },
        ]}
      />

      <SiteFooter />
    </main>
  </div>
}
