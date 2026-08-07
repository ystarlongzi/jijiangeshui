'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatMoney, type DigitGrouping } from '@/lib/money-format'

type MoneyFormatContextValue = {
  grouping: DigitGrouping
  setGrouping: (grouping: DigitGrouping) => void
  toggleGrouping: () => void
  money: (value: number, decimals?: number) => string
}

const storageKey = 'tax-money-grouping'
const MoneyFormatContext = createContext<MoneyFormatContextValue | null>(null)

export function MoneyFormatProvider({ children }: { children: ReactNode }) {
  const [grouping, setGroupingState] = useState<DigitGrouping>('thousand')

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'thousand' || saved === 'wan') setGroupingState(saved)
  }, [])

  const setGrouping = (nextGrouping: DigitGrouping) => {
    setGroupingState(nextGrouping)
    localStorage.setItem(storageKey, nextGrouping)
  }

  const value = useMemo<MoneyFormatContextValue>(() => ({
    grouping,
    setGrouping,
    toggleGrouping: () => setGrouping(grouping === 'thousand' ? 'wan' : 'thousand'),
    money: (value, decimals = 0) => formatMoney(value, { decimals, grouping }),
  }), [grouping])

  return <MoneyFormatContext.Provider value={value}>{children}</MoneyFormatContext.Provider>
}

export function useMoneyFormat() {
  const context = useContext(MoneyFormatContext)
  if (!context) throw new Error('useMoneyFormat must be used inside MoneyFormatProvider')
  return context
}
