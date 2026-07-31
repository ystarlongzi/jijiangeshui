'use client'

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { sumSpecialDeductions } from '@/lib/special-deductions'
import { useMoneyFormat } from './MoneyFormatProvider'
import Modal from './Modal'
import SpecialDeductionGroupList from './SpecialDeductionGroupList'
import { trackEvent } from './analytics'

type SpecialDeductionSelectorProps = {
  open: boolean
  value: Record<string, string>
  description?: string
  emptyText?: string
  onClose: () => void
  onSave: (value: Record<string, string>, amount: number) => void
}

export default function SpecialDeductionSelector({
  open,
  value,
  description = '选择后会按月扣除额汇总，并回填到输入框内。',
  emptyText = '大病医疗通常在年度汇算时按实际发生额扣除，暂不参与本月预扣计算。',
  onClose,
  onSave,
}: SpecialDeductionSelectorProps) {
  const { money } = useMoneyFormat()
  const [draftValue, setDraftValue] = useState<Record<string, string>>(value)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const draftAmount = sumSpecialDeductions(draftValue)

  useEffect(() => {
    if (!open) return
    setDraftValue(value)
    setExpandedGroups([])
    trackEvent('deduction_selector_open', { selectedGroups: Object.keys(value).length })
  }, [open, value])

  const toggleGroup = (group: string) => {
    setExpandedGroups((current) => {
      const expanded = !current.includes(group)
      trackEvent('deduction_selector_group_toggle', { group, expanded })
      return expanded ? [...current, group] : current.filter((item) => item !== group)
    })
  }

  const selectOption = (group: string, option: string) => {
    setDraftValue((current) => {
      const next = { ...current }
      const selected = next[group] !== option
      if (selected) next[group] = option
      else delete next[group]
      trackEvent('deduction_selector_option_toggle', { group, option, selected })
      return next
    })
  }

  const clearSelections = () => {
    setDraftValue({})
    trackEvent('deduction_selector_clear', { amount: draftAmount })
  }

  const saveSelections = () => {
    trackEvent('deduction_selector_save', { amount: draftAmount, selectedGroups: Object.keys(draftValue).length })
    onSave(draftValue, draftAmount)
  }

  return <Modal
    open={open}
    title="选择专项附加扣除"
    description={description}
    onClose={onClose}
    footer={<div className="deduction-dialog-footer">
      <div className="deduction-dialog-summary">
        <span>本月合计</span>
        <strong>{money(draftAmount)}</strong>
      </div>
      <div className="deduction-dialog-actions">
        <button className="secondary-button" type="button" onClick={clearSelections}>清空选择</button>
        <button className="primary-button" type="button" onClick={saveSelections}>
          保存并回填 <ArrowRight size={16} />
        </button>
      </div>
    </div>}
  >
    <SpecialDeductionGroupList
      selections={draftValue}
      expandedGroups={expandedGroups}
      emptyText={emptyText}
      onSelect={selectOption}
      onToggleGroup={toggleGroup}
    />
  </Modal>
}
