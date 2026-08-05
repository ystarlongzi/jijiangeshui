'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, MapPin, Search, Sparkles } from 'lucide-react'
import TrackedLink from '../../../_components/TrackedLink'
import styles from './CityRuleExplorer.module.css'

export type CityRuleExplorerItem = {
  key: string
  label: string
  name: string
  pinyin: string
  province: string
}

type CityRuleExplorerProps = {
  cities: CityRuleExplorerItem[]
  popularCities: CityRuleExplorerItem[]
}

export default function CityRuleExplorer({ cities, popularCities }: CityRuleExplorerProps) {
  const [query, setQuery] = useState('')
  const [province, setProvince] = useState('all')
  const provinceCounts = useMemo(() => cities.reduce<Record<string, number>>((counts, city) => {
    return { ...counts, [city.province]: (counts[city.province] || 0) + 1 }
  }, {}), [cities])
  const provinces = useMemo(() => Object.keys(provinceCounts), [provinceCounts])
  const filteredCities = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return cities.filter((city) => {
      const matchedProvince = province === 'all' || city.province === province
      const matchedKeyword = !keyword || `${city.label} ${city.name} ${city.province} ${city.pinyin} ${city.key}`.toLowerCase().includes(keyword)
      return matchedProvince && matchedKeyword
    })
  }, [cities, province, query])
  const groupedCities = useMemo(() => {
    const groups = filteredCities.reduce<Record<string, CityRuleExplorerItem[]>>((result, city) => ({
      ...result,
      [city.province]: [...(result[city.province] || []), city],
    }), {})
    return Object.entries(groups)
  }, [filteredCities])
  const isFiltered = Boolean(query.trim() || province !== 'all')

  function clearFilters() {
    setQuery('')
    setProvince('all')
  }

  return <section className={styles.explorer} aria-label="城市规则目录">
    <div className={styles.directoryIntro}>
      <div>
        <span className={styles.eyebrow}>城市目录</span>
        <h2>先选城市，再看规则</h2>
        <p>按城市查看社保、公积金基数范围，进入详情页后可直接开始计算。</p>
      </div>
      <span className={styles.totalCount}>{cities.length} 个城市</span>
    </div>

    <div className={styles.searchRow}>
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
      {isFiltered && <button className={styles.clearButton} type="button" onClick={clearFilters}>清除筛选</button>}
    </div>

    {popularCities.length > 0 && <div className={styles.popularRow}>
      <div className={styles.popularLabel}><Sparkles aria-hidden="true" size={16} /><span>热门城市</span></div>
      <div className={styles.popularLinks}>
        {popularCities.map((city) => <TrackedLink
          className={styles.popularLink}
          eventPayload={{ module: 'city_index', label: '热门城市', city: city.key }}
          href={`/city/${city.key}`}
          key={city.key}
        >
          {city.label}<ArrowRight aria-hidden="true" size={14} />
        </TrackedLink>)}
      </div>
    </div>}

    <div className={styles.directoryToolbar}>
      <div className={styles.resultMeta}>
        <strong>{isFiltered ? '筛选结果' : '全部城市'}</strong>
        <span>{filteredCities.length} 个城市</span>
      </div>
      <div className={styles.provinceFilter} aria-label="按省份筛选">
        <button aria-pressed={province === 'all'} className={province === 'all' ? styles.active : ''} type="button" onClick={() => setProvince('all')}>全部</button>
        {provinces.map((item) => <button
          aria-pressed={province === item}
          className={province === item ? styles.active : ''}
          key={item}
          type="button"
          onClick={() => setProvince(item)}
        >
          {item}<span>{provinceCounts[item]}</span>
        </button>)}
      </div>
    </div>

    {groupedCities.length > 0 ? <div className={styles.groupList}>
      {groupedCities.map(([provinceName, group]) => <section className={styles.group} key={provinceName}>
        <div className={styles.groupHeading}>
          <div><MapPin aria-hidden="true" size={16} /><h3>{provinceName}</h3></div>
          <span>{group.length} 个城市</span>
        </div>
        <div className={styles.cityList}>
          {group.map((city) => <TrackedLink
            className={styles.cityEntry}
            eventPayload={{ module: 'city_index', label: '城市规则', city: city.key }}
            href={`/city/${city.key}`}
            key={city.key}
          >
            <span className={styles.cityName}><span>{city.label}</span><small>{city.pinyin}</small></span>
            <span className={styles.cityAction}>查看规则 <ArrowRight aria-hidden="true" size={14} /></span>
          </TrackedLink>)}
        </div>
      </section>)}
    </div> : <div className={styles.empty}>没有找到匹配城市，可以换个城市名、省份或拼音试试。</div>}
  </section>
}
