'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { CitySummary } from '@/lib/city-rule-types'
import styles from './CitySelect.module.css'

type CitySelectProps = {
  action?: ReactNode
  className?: string
  id: string
  invalid?: boolean
  label: ReactNode
  onChange: (value: string) => void
  cities: CitySummary[]
  value: string
}

const SUGGESTION_LIMIT = 20

type CityListResponse = {
  items?: CitySummary[]
}

export default function CitySelect({ action, className, id, invalid = false, label, onChange, cities, value }: CitySelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [remoteCities, setRemoteCities] = useState<CitySummary[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const listId = `${id}-listbox`

  const options = useMemo(() => mergeCities(cities, remoteCities), [cities, remoteCities])
  const selected = options.find((option) => option.slug === value)
  const selectedLabel = selected?.label || value
  const fieldClassName = [styles.field, className].filter(Boolean).join(' ')
  const controlClassName = [styles.control, open ? styles.open : '', invalid ? styles.invalid : ''].filter(Boolean).join(' ')
  const visibleOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = !keyword || keyword === selectedLabel.toLowerCase()
      ? options
      : options.filter((option) => getSearchText(option).includes(keyword))
    return filtered.slice(0, SUGGESTION_LIMIT)
  }, [options, query, selectedLabel])
  const isFiltered = query.trim() !== '' && query.trim().toLowerCase() !== selectedLabel.toLowerCase()
  const helperText = loading
    ? '正在联想城市…'
    : searchFailed
      ? '城市联想暂时不可用，请稍后重试。'
      : isFiltered
        ? `找到 ${visibleOptions.length} 个匹配城市`
        : `已加载 ${Math.min(options.length, SUGGESTION_LIMIT)} 个城市，可输入城市名或拼音搜索`

  useEffect(() => {
    setQuery(selectedLabel)
  }, [selectedLabel])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!value || selected) return
    const controller = new AbortController()
    void fetch(`/api/cities?keyword=${encodeURIComponent(value)}&limit=${SUGGESTION_LIMIT}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('city-lookup-failed')
        return response.json() as Promise<CityListResponse>
      })
      .then((data) => setRemoteCities((current) => mergeCities(current, data.items || [])))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSearchFailed(true)
      })
    return () => controller.abort()
  }, [selected, value])

  useEffect(() => {
    const keyword = query.trim()
    if (!open || !keyword || keyword.toLowerCase() === selectedLabel.toLowerCase()) return

    let controller: AbortController | undefined
    const timer = window.setTimeout(() => {
      const requestController = new AbortController()
      controller = requestController
      setLoading(true)
      setSearchFailed(false)
      void fetch(`/api/cities?keyword=${encodeURIComponent(keyword)}&limit=${SUGGESTION_LIMIT}`, { signal: requestController.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('city-search-failed')
          return response.json() as Promise<CityListResponse>
        })
        .then((data) => setRemoteCities((current) => mergeCities(current, data.items || [])))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setSearchFailed(true)
        })
        .finally(() => setLoading(false))
    }, 180)

    return () => {
      window.clearTimeout(timer)
      controller?.abort()
    }
  }, [open, query, selectedLabel])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery(selectedLabel)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selectedLabel])

  const choose = (option: CitySummary) => {
    onChange(option.slug)
    setQuery(option.label)
    setOpen(false)
    inputRef.current?.blur()
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
      setQuery(selectedLabel)
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
        ref={inputRef}
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
        <div className={styles.popoverHint}>{helperText}</div>
        {visibleOptions.length > 0 ? visibleOptions.map((option, index) => {
          const isSelected = option.slug === value
          const isActive = index === activeIndex
          return <button
            aria-selected={isSelected}
            className={[styles.option, isSelected ? styles.selected : '', isActive ? styles.active : ''].filter(Boolean).join(' ')}
            key={option.slug}
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

function mergeCities(...groups: CitySummary[][]) {
  const cities = new Map<string, CitySummary>()
  for (const group of groups) {
    for (const city of group) cities.set(city.slug, city)
  }
  return [...cities.values()].sort((prev, next) => prev.province.localeCompare(next.province, 'zh-CN') || prev.label.localeCompare(next.label, 'zh-CN'))
}

function getSearchText(city: CitySummary) {
  return `${city.label} ${city.name} ${city.province} ${city.pinyin} ${city.slug}`.toLowerCase()
}
