'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import TrackedLink from '../../../_components/TrackedLink'
import styles from './CityRuleExplorer.module.css'

export type CityRuleExplorerItem = {
  effective: string
  housingBaseRange: string
  key: string
  label: string
  name: string
  pinyin: string
  province: string
  socialBaseRange: string
  sourceReady: boolean
}

type CityRuleExplorerProps = {
  cities: CityRuleExplorerItem[]
}

export default function CityRuleExplorer({ cities }: CityRuleExplorerProps) {
  const [query, setQuery] = useState('')
  const [province, setProvince] = useState('all')
  const provinces = useMemo(() => Array.from(new Set(cities.map((city) => city.province))), [cities])
  const filteredCities = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return cities.filter((city) => {
      const matchedProvince = province === 'all' || city.province === province
      const matchedKeyword = !keyword || `${city.label} ${city.name} ${city.province} ${city.pinyin} ${city.key}`.toLowerCase().includes(keyword)
      return matchedProvince && matchedKeyword
    })
  }, [cities, province, query])

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
          {item}
        </button>)}
      </div>
    </div>

    <div className={styles.resultMeta}>
      <span>共 {filteredCities.length} 个城市</span>
      {(query || province !== 'all') && <button type="button" onClick={() => { setQuery(''); setProvince('all') }}>清除筛选</button>}
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
          <em>生效 {city.effective}</em>
          <em className={city.sourceReady ? styles.okStatus : styles.warnStatus}>{city.sourceReady ? '已配置来源' : '来源待补'}</em>
        </div>
        <strong>查看城市规则 <ArrowRight size={14} /></strong>
      </TrackedLink>)}
    </div> : <div className={styles.empty}>没有找到匹配城市，可以换个城市名、省份或拼音试试。</div>}
  </section>
}
