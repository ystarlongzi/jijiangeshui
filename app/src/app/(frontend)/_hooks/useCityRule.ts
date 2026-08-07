'use client'

import { useEffect, useState } from 'react'
import type { CityRuleLoadStatus } from '@/lib/city-rule-types'
import type { CityRule } from '@/lib/tax-rules'

type CityRuleResponse = CityRuleLoadStatus & {
  rule?: CityRule
}

type UseCityRuleOptions = {
  initialRule?: CityRule
  initialRuleStatus?: CityRuleLoadStatus
  initialCity?: string
}

type CachedCityRule = {
  rule: CityRule
  status?: CityRuleLoadStatus
}

export default function useCityRule(city: string, options: UseCityRuleOptions = {}) {
  const { initialCity = 'beijing', initialRule, initialRuleStatus } = options
  const [cachedRules, setCachedRules] = useState<Record<string, CachedCityRule>>({})
  const [rule, setRule] = useState<CityRule | undefined>(initialRule)
  const [loadedCity, setLoadedCity] = useState(initialRule ? initialCity : '')
  const [status, setStatus] = useState<CityRuleLoadStatus | undefined>(initialRuleStatus)
  const [loading, setLoading] = useState(!initialRule)
  const [error, setError] = useState('')

  useEffect(() => {
    if (city === initialCity && initialRule) {
      setCachedRules((current) => current[initialCity] ? current : { ...current, [initialCity]: { rule: initialRule, status: initialRuleStatus } })
      setRule(initialRule)
      setLoadedCity(city)
      setStatus(initialRuleStatus)
      setLoading(false)
      setError('')
      return
    }

    const cached = cachedRules[city]
    if (cached) {
      setRule(cached.rule)
      setLoadedCity(city)
      setStatus(cached.status)
      setLoading(false)
      setError('')
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')

    void fetch(`/api/cities/${encodeURIComponent(city)}/rules`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as CityRuleResponse
        if (!response.ok || !data.rule) throw new Error(data.fallbackReason || 'city-rule-load-failed')
        return data
      })
      .then((data) => {
        const normalizedRule = normalizeCityRule(data.rule as CityRule)
        const nextStatus = { source: data.source, fallbackReason: data.fallbackReason }
        setCachedRules((current) => ({ ...current, [city]: { rule: normalizedRule, status: nextStatus } }))
        setRule(normalizedRule)
        setLoadedCity(city)
        setStatus(nextStatus)
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError('暂时无法加载该城市的社保公积金规则。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [city, initialCity, initialRule, initialRuleStatus, cachedRules])

  const cached = cachedRules[city]
  const visibleRule = cached?.rule || rule
  const visibleStatus = cached?.status || status
  const visibleLoadedCity = cached ? city : loadedCity

  return {
    // 切换城市时保留上一份规则，交给页面用遮罩提示加载，避免结果区域闪烁。
    rule: visibleRule,
    status: visibleStatus,
    loadedCity: visibleLoadedCity,
    // 命中缓存时直接展示缓存规则，不显示 loading。
    loading: cached ? false : loading && !visibleRule,
    fetching: cached ? false : loading || (loadedCity !== city && !error),
    error,
  }
}

function normalizeCityRule(rule: CityRule): CityRule {
  return {
    ...rule,
    sources: Array.isArray(rule.sources) ? rule.sources : [],
    policyVersions: rule.policyVersions?.map((version) => normalizeCityRule(version)),
  }
}
