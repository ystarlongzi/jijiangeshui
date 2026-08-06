'use client'

import { useCallback } from 'react'
import type { CitySummary } from '@/lib/city-rule-types'

type Notify = (message: string) => void
type CityListResponse = { items?: CitySummary[] }
type ReverseLocationResponse = { city?: string; province?: string; displayName?: string; message?: string }
function normalizeCityName(value: string) {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/gu, '').replace(/(特别行政区|自治州|地区|盟|市|区|县)$/u, '')
}

function getCityCandidates(data: ReverseLocationResponse) {
  const displayCandidates = (data.displayName || '')
    .split(/[，,]/u)
    .map((part) => part.trim())
    .filter((part) => /(?:特别行政区|自治州|地区|盟|市)$/u.test(part))

  return [...displayCandidates, data.city || ''].filter(Boolean)
}

function matchCity(cities: CitySummary[], candidates: string[]) {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCityName(candidate)
    const matched = cities.find((city) => {
      const names = [city.label, city.name].map(normalizeCityName)
      // 只按城市本身匹配，不用省份兜底，否则“广东省”可能误选成该省第一个城市。
      return names.includes(normalizedCandidate)
    })
    if (matched) return matched
  }
  return undefined
}

export default function useCityLocator(notify: Notify, options: { cities?: CitySummary[]; onLocated?: (city: string) => void } = {}) {
  const { cities = [], onLocated } = options

  return useCallback(() => {
    if (!navigator.geolocation) {
      notify('当前浏览器不支持自动定位，请手动选择城市')
      return
    }

    notify('正在获取位置，请允许浏览器访问定位权限')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const params = new URLSearchParams({ lat: String(position.coords.latitude), lon: String(position.coords.longitude) })
            const response = await fetch(`/api/location/reverse?${params.toString()}`)
            const data = await response.json() as ReverseLocationResponse
            if (!response.ok || !data.city) {
              notify(data.message || '已获取位置，但暂时无法识别城市，请手动选择')
              return
            }

            const cityCandidates = getCityCandidates(data)
            let matched = matchCity(cities, cityCandidates)

            if (!matched) {
              for (const candidate of cityCandidates) {
                const cityResponse = await fetch(`/api/cities?keyword=${encodeURIComponent(candidate)}&limit=20`)
                if (!cityResponse.ok) continue
                const cityResult = await cityResponse.json() as CityListResponse
                matched = matchCity(cityResult.items || [], [candidate])
                if (matched) break
              }
            }

            if (!matched) {
              notify(`已定位到${data.city}，但城市规则列表中暂未匹配，请手动选择`)
              return
            }

            onLocated?.(matched.slug)
            notify(`已定位到${matched.label}，已切换对应城市规则`)
          } catch {
            notify('已获取位置，但暂时无法识别城市，请手动选择')
          }
        })()
      },
      () => notify('暂时无法获取位置，请手动选择城市'),
    )
  }, [notify, onLocated, cities])
}
