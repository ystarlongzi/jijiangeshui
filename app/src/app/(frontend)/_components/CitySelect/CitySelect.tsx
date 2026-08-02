'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import type { CityRule } from '@/lib/tax-rules'
import styles from './CitySelect.module.css'

type CitySelectProps = {
  action?: ReactNode
  className?: string
  id: string
  invalid?: boolean
  label: ReactNode
  onChange: (value: string) => void
  rules: Record<string, CityRule>
  value: string
}

type CityOption = {
  key: string
  label: string
  province: string
  pinyin: string
  searchText: string
}

export default function CitySelect({ action, className, id, invalid = false, label, onChange, rules, value }: CitySelectProps) {
  const options = useMemo(() => Object.entries(rules).map(([key, rule]) => ({
    key,
    label: rule.label,
    province: rule.province,
    pinyin: rule.pinyin,
    searchText: `${rule.label} ${rule.name} ${rule.province} ${rule.pinyin} ${key}`.toLowerCase(),
  })).sort((prev, next) => {
    const provinceOrder = prev.province.localeCompare(next.province, 'zh-CN')
    if (provinceOrder !== 0) return provinceOrder
    return prev.label.localeCompare(next.label, 'zh-CN')
  }), [rules])
  const selected = options.find((option) => option.key === value)
  const [query, setQuery] = useState(selected?.label || '')
  const listId = `${id}-list`
  const fieldClassName = [styles.field, className].filter(Boolean).join(' ')
  const controlClassName = [styles.control, invalid ? styles.invalid : ''].filter(Boolean).join(' ')
  const visibleOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return options.slice(0, 80)
    return options.filter((option) => option.searchText.includes(keyword)).slice(0, 80)
  }, [options, query])

  useEffect(() => {
    setQuery(selected?.label || '')
  }, [selected?.label])

  const commit = (nextQuery: string) => {
    const keyword = nextQuery.trim().toLowerCase()
    if (!keyword) return
    const matched = options.find((option) => option.label === nextQuery || option.key === nextQuery || option.searchText.includes(keyword))
    if (matched) onChange(matched.key)
  }

  return <div className={fieldClassName}>
    <div className={styles.labelRow}><label htmlFor={id}>{label}</label>{action}</div>
    <div className={controlClassName}>
      <Search aria-hidden="true" size={16} />
      <input
        autoComplete="off"
        id={id}
        list={listId}
        value={query}
        onBlur={() => setQuery(options.find((option) => option.key === value)?.label || '')}
        onChange={(event) => {
          const nextQuery = event.target.value
          setQuery(nextQuery)
          commit(nextQuery)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit(query)
          }
        }}
      />
      <datalist id={listId}>
        {visibleOptions.map((option) => <option key={option.key} value={option.label}>{option.province} · {option.pinyin}</option>)}
      </datalist>
    </div>
  </div>
}
