'use client'

import { ChevronDown } from 'lucide-react'
import { specialDeductionGroups, specialDeductionItems } from '@/lib/special-deductions'
import { useMoneyFormat } from '../MoneyFormatProvider'
import styles from './SpecialDeductionGroupList.module.css'

type SpecialDeductionGroupListProps = {
  selections: Record<string, string>
  expandedGroups: string[]
  emptyText?: string
  className?: string
  onSelect: (group: string, option: string) => void
  onToggleGroup: (group: string) => void
}

export default function SpecialDeductionGroupList({
  selections,
  expandedGroups,
  emptyText = '大病医疗通常在年度汇算时按实际发生额扣除，暂不参与本月预扣计算。',
  className,
  onSelect,
  onToggleGroup,
}: SpecialDeductionGroupListProps) {
  const { money } = useMoneyFormat()

  const listClassName = [styles.list, className].filter(Boolean).join(' ')

  return <div className={listClassName}>
    {specialDeductionGroups.map((group) => {
      const selectedOption = specialDeductionItems.find((item) => item.id === selections[group.key])
      const expanded = expandedGroups.includes(group.key)

      return <div className={`${styles.group}${group.options.length === 0 ? ` ${styles.disabled}` : ''}`} key={group.key}>
        <button className={styles.heading} type="button" onClick={() => onToggleGroup(group.key)} aria-expanded={expanded}>
          <span className={`${styles.status}${selectedOption ? ` ${styles.selected}` : ''}`} aria-hidden="true" />
          <span>
            <strong>{group.title}{selectedOption && <b>{money(selectedOption.amount)} / 月</b>}</strong>
            <small>{group.note}</small>
          </span>
          <ChevronDown size={16} />
        </button>
        {expanded && (group.options.length > 0 ? <div className={styles.options}>
          {group.options.map((item) => <label className={`${styles.option}${selections[group.key] === item.id ? ` ${styles.selected}` : ''}`} key={item.id}>
            <input type="checkbox" checked={selections[group.key] === item.id} onChange={() => onSelect(group.key, item.id)} />
            <span>{item.label}</span>
            <b>{money(item.amount)} / 月</b>
          </label>)}
        </div> : <p>{emptyText}</p>)}
      </div>
    })}
  </div>
}
