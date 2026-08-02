'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import TrackedLink from '../../../_components/TrackedLink'
import styles from './CityRuleExplorer.module.css'

export type CityRuleExplorerItem = {
  checkedAt: string
  effective: string
  freshnessLabel: string
  freshnessStatus: 'fresh' | 'stale' | 'missing'
  housingBaseRange: string
  key: string
  label: string
  name: string
  pinyin: string
  province: string
  socialBaseRange: string
  sourceLabel: string
  sourceType: 'payload' | 'fallback'
  sourceReady: boolean
}

type CityRuleExplorerProps = {
  cities: CityRuleExplorerItem[]
}

export default function CityRuleExplorer({ cities }: CityRuleExplorerProps) {
  const [query, setQuery] = useState('')
  const [province, setProvince] = useState('all')
  const [healthFilter, setHealthFilter] = useState<'all' | 'stale' | 'sourceMissing'>('all')
  const provinceCounts = useMemo(() => cities.reduce<Record<string, number>>((counts, city) => {
    counts[city.province] = (counts[city.province] || 0) + 1
    return counts
  }, {}), [cities])
  const provinces = useMemo(() => Object.keys(provinceCounts), [provinceCounts])
  const filteredCities = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return cities.filter((city) => {
      const matchedProvince = province === 'all' || city.province === province
      const matchedKeyword = !keyword || `${city.label} ${city.name} ${city.province} ${city.pinyin} ${city.key}`.toLowerCase().includes(keyword)
      const matchedHealth =
        healthFilter === 'all' ||
        (healthFilter === 'stale' && city.freshnessStatus !== 'fresh') ||
        (healthFilter === 'sourceMissing' && !city.sourceReady)
      return matchedProvince && matchedKeyword && matchedHealth
    })
  }, [cities, healthFilter, province, query])

  return <section className={styles.explorer} aria-label="已收录城市">
    <div className={styles.toolbar}>
      <label className={styles.searchBox}>
        <Search aria-hidden="true" size={16} />
        <input
          aria-label="搜索城市"
          autoComplete="off"
          placeholder="搜索城市、省份或拼音"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={styles.provinceFilter} aria-label="按省份筛选">
        <button className={province === 'all' ? styles.active : ''} type="button" onClick={() => setProvince('all')}>全部</button>
        {provinces.map((item) => <button
          className={province === item ? styles.active : ''}
          key={item}
          type="button"
          onClick={() => setProvince(item)}
        >
          {item}<span>{provinceCounts[item]}</span>
        </button>)}
      </div>
    </div>

    <div className={styles.healthFilter} aria-label="按维护状态筛选">
      <button className={healthFilter === 'all' ? styles.active : ''} type="button" onClick={() => setHealthFilter('all')}>全部状态</button>
      <button className={healthFilter === 'stale' ? styles.active : ''} type="button" onClick={() => setHealthFilter('stale')}>待复核</button>
      <button className={healthFilter === 'sourceMissing' ? styles.active : ''} type="button" onClick={() => setHealthFilter('sourceMissing')}>来源待补</button>
    </div>

    <div className={styles.resultMeta}>
      <span>{filteredCities.length === cities.length ? `已收录 ${cities.length} 个城市` : `已显示 ${filteredCities.length} / ${cities.length} 个城市`}</span>
      {(query || province !== 'all' || healthFilter !== 'all') && <button type="button" onClick={() => { setQuery(''); setProvince('all'); setHealthFilter('all') }}>清除筛选</button>}
    </div>

    {filteredCities.length > 0 ? <div className={styles.grid}>
      {filteredCities.map((city) => <TrackedLink
        className={styles.card}
        eventPayload={{ module: 'city_index', label: '城市规则', city: city.key }}
        href={`/city/${city.key}`}
        key={city.key}
      >
        <span>{city.label}</span>
        <small>{city.province} · {city.pinyin}</small>
        <dl>
          <div><dt>社保基数</dt><dd>{city.socialBaseRange}</dd></div>
          <div><dt>公积金基数</dt><dd>{city.housingBaseRange}</dd></div>
        </dl>
        <div className={styles.ruleMeta}>
          <em className={city.sourceType === 'payload' ? styles.cmsStatus : styles.fallbackStatus}>{city.sourceLabel}</em>
          <em>生效 {city.effective}</em>
          <em data-freshness={city.freshnessStatus}>核对 {city.checkedAt} · {city.freshnessLabel}</em>
          <em className={city.sourceReady ? styles.okStatus : styles.warnStatus}>{city.sourceReady ? '已配置来源' : '来源待补'}</em>
        </div>
        <strong>查看城市规则 <ArrowRight size={14} /></strong>
      </TrackedLink>)}
    </div> : <div className={styles.empty}>没有找到匹配城市，可以换个城市名、省份或拼音试试。</div>}
  </section>
}
