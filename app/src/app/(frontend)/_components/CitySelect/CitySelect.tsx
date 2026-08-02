'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
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
  const rootRef = useRef<HTMLDivElement>(null)
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
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = `${id}-listbox`
  const fieldClassName = [styles.field, className].filter(Boolean).join(' ')
  const controlClassName = [styles.control, open ? styles.open : '', invalid ? styles.invalid : ''].filter(Boolean).join(' ')
  const visibleOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword || keyword === selected?.label.toLowerCase()) return options.slice(0, 80)
    return options.filter((option) => option.searchText.includes(keyword)).slice(0, 80)
  }, [options, query, selected?.label])

  useEffect(() => {
    setQuery(selected?.label || '')
  }, [selected?.label])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery(selected?.label || '')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selected?.label])

  const choose = (option: CityOption) => {
    onChange(option.key)
    setQuery(option.label)
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => Math.min(current + 1, visibleOptions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const option = visibleOptions[activeIndex]
      if (option) choose(option)
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
      setQuery(selected?.label || '')
    }
  }

  return <div className={fieldClassName} ref={rootRef}>
    <div className={styles.labelRow}><label htmlFor={id}>{label}</label>{action}</div>
    <div className={controlClassName}>
      <Search className={styles.searchIcon} aria-hidden="true" size={16} />
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        autoComplete="off"
        id={id}
        role="combobox"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown className={styles.chevronIcon} aria-hidden="true" size={16} />
      {open && <div className={styles.popover} id={listId} role="listbox">
        {visibleOptions.length > 0 ? visibleOptions.map((option, index) => {
          const isSelected = option.key === value
          const isActive = index === activeIndex
          return <button
            aria-selected={isSelected}
            className={[styles.option, isSelected ? styles.selected : '', isActive ? styles.active : ''].filter(Boolean).join(' ')}
            key={option.key}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
            role="option"
            type="button"
          >
            <span>
              <strong>{option.label}</strong>
              <small>{option.province} · {option.pinyin}</small>
            </span>
            {isSelected && <Check aria-hidden="true" size={16} />}
          </button>
        }) : <div className={styles.empty}>没有匹配的城市</div>}
      </div>}
    </div>
  </div>
}
