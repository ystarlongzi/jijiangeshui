'use client'

import { useCallback, useMemo, useState } from 'react'
import { specialDeductionItems as defaultItems, sumSpecialDeductions, type SpecialDeductionItem } from '@/lib/special-deductions'

type SpecialDeductionSelectionOptions = {
  items?: SpecialDeductionItem[]
  initialSelections?: Record<string, string>
  initialExpandedGroups?: string[]
  onGroupToggle?: (group: string, expanded: boolean) => void
  onOptionToggle?: (group: string, option: string, selected: boolean) => void
}

export default function useSpecialDeductionSelection({
  items = defaultItems,
  initialSelections = {},
  initialExpandedGroups = [],
  onGroupToggle,
  onOptionToggle,
}: SpecialDeductionSelectionOptions = {}) {
  const [selections, setSelections] = useState<Record<string, string>>(initialSelections)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(initialExpandedGroups)
  const amount = useMemo(() => sumSpecialDeductions(selections, items), [items, selections])
  const selectedItems = useMemo(() => Object.values(selections).map((id) => items.find((item) => item.id === id)).filter(Boolean), [items, selections])

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups((current) => {
      const expanded = !current.includes(group)
      onGroupToggle?.(group, expanded)
      return expanded ? [...current, group] : current.filter((item) => item !== group)
    })
  }, [onGroupToggle])

  const selectOption = useCallback((group: string, option: string) => {
    setSelections((current) => {
      const next = { ...current }
      const selected = next[group] !== option
      if (selected) next[group] = option
      else delete next[group]
      onOptionToggle?.(group, option, selected)
      return next
    })
  }, [onOptionToggle])

  const clearSelections = useCallback(() => setSelections({}), [])

  const resetSelectionState = useCallback((nextSelections: Record<string, string> = {}, nextExpandedGroups: string[] = []) => {
    setSelections(nextSelections)
    setExpandedGroups(nextExpandedGroups)
  }, [])

  return {
    amount,
    clearSelections,
    expandedGroups,
    resetSelectionState,
    selectOption,
    selectedItems,
    selections,
    setExpandedGroups,
    setSelections,
    toggleGroup,
  }
}
