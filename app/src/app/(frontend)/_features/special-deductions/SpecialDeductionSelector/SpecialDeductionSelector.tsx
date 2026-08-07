'use client'

import { useCallback, useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import type { SpecialDeductionGroup, SpecialDeductionItem } from '@/lib/special-deductions'
import { Button } from '../../../_components/Button'
import { useMoneyFormat } from '../../../_components/MoneyFormatProvider'
import Modal from '../../../_components/Modal'
import SpecialDeductionGroupList from '../SpecialDeductionGroupList'
import useSpecialDeductionSelection from '../useSpecialDeductionSelection'
import { trackEvent } from '../../../_lib/analytics'
import styles from './SpecialDeductionSelector.module.css'

type SpecialDeductionSelectorProps = {
  groups?: SpecialDeductionGroup[]
  items?: SpecialDeductionItem[]
  open: boolean
  value: Record<string, string>
  description?: string
  emptyText?: string
  onClose: () => void
  onSave: (value: Record<string, string>, amount: number) => void
}

export default function SpecialDeductionSelector({
  groups,
  items,
  open,
  value,
  description = '选择后会按月扣除额汇总，并回填到输入框内。',
  emptyText = '大病医疗通常在年度汇算时按实际发生额扣除，暂不参与本月预扣计算。',
  onClose,
  onSave,
}: SpecialDeductionSelectorProps) {
  const { money } = useMoneyFormat()
  const trackGroupToggle = useCallback((group: string, expanded: boolean) => {
    trackEvent('deduction_selector_group_toggle', { group, expanded })
  }, [])
  const trackOptionToggle = useCallback((group: string, option: string, selected: boolean) => {
    trackEvent('deduction_selector_option_toggle', { group, option, selected })
  }, [])
  const {
    amount: draftAmount,
    clearSelections: clearDraftSelections,
    expandedGroups,
    resetSelectionState,
    selectOption,
    selections: draftValue,
    toggleGroup,
  } = useSpecialDeductionSelection({
    items,
    onGroupToggle: trackGroupToggle,
    onOptionToggle: trackOptionToggle,
  })

  const clearSelections = () => {
    clearDraftSelections()
    trackEvent('deduction_selector_clear', { amount: draftAmount })
  }

  const saveSelections = () => {
    trackEvent('deduction_selector_save', { amount: draftAmount, selectedGroups: Object.keys(draftValue).length })
    onSave(draftValue, draftAmount)
  }

  useEffect(() => {
    if (!open) return
    resetSelectionState(value)
    trackEvent('deduction_selector_open', { selectedGroups: Object.keys(value).length })
  }, [open, resetSelectionState, value])

  return <Modal
    open={open}
    title="选择专项附加扣除"
    description={description}
    onClose={onClose}
    footer={<div className={styles.footer}>
      <div className={styles.summary}>
        <span>本月合计</span>
        <strong>{money(draftAmount)}</strong>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" type="button" onClick={clearSelections}>清空选择</Button>
        <Button variant="primary" type="button" onClick={saveSelections}>
          保存并回填 <ArrowRight size={16} />
        </Button>
      </div>
    </div>}
  >
    <SpecialDeductionGroupList
      groups={groups}
      items={items}
      selections={draftValue}
      expandedGroups={expandedGroups}
      emptyText={emptyText}
      onSelect={selectOption}
      onToggleGroup={toggleGroup}
    />
  </Modal>
}
