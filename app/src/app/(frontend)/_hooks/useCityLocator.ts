'use client'

import { useCallback } from 'react'
import type { CityRule } from '@/lib/tax-rules'

type Notify = (message: string) => void
type CityRuleLookup = Record<string, Pick<CityRule, 'label' | 'name' | 'province'>>

function normalizeCityName(value: string) {
  return value.trim().toLowerCase().replace(/(特别行政区|自治州|地区|盟|市)$/u, '')
}

export default function useCityLocator(notify: Notify, options: { rules?: CityRuleLookup; onLocated?: (city: string) => void } = {}) {
  const { rules = {}, onLocated } = options

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
            const data = await response.json() as { city?: string; province?: string; message?: string }
            if (!response.ok || !data.city) {
              notify(data.message || '已获取位置，但暂时无法识别城市，请手动选择')
              return
            }

            const normalizedCity = normalizeCityName(data.city)
            const matched = Object.entries(rules).find(([, rule]) => {
              const names = [rule.label, rule.name].map(normalizeCityName)
              // 只按城市本身匹配，不用省份兜底，否则“广东省”可能误选成该省第一个城市。
              return names.includes(normalizedCity)
            })

            if (!matched) {
              notify(`已定位到${data.city}，但城市规则列表中暂未匹配，请手动选择`)
              return
            }

            onLocated?.(matched[0])
            notify(`已定位到${matched[1].label}，已切换对应城市规则`)
          } catch {
            notify('已获取位置，但暂时无法识别城市，请手动选择')
          }
        })()
      },
      () => notify('暂时无法获取位置，请手动选择城市'),
    )
  }, [notify, onLocated, rules])
}
