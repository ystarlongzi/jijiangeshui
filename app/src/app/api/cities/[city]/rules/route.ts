import { NextResponse } from 'next/server'

import { getAvailableCity, getAvailableCityRuleResult } from '@/lib/city-rule-service'
import type { CityRule } from '@/lib/tax-rules'

type CityRuleRouteProps = {
  params: Promise<{ city: string }>
}

export async function GET(_request: Request, { params }: CityRuleRouteProps) {
  const { city: slug } = await params
  if (!/^[a-z0-9-]{1,100}$/u.test(slug)) {
    return NextResponse.json({ message: '城市标识无效。' }, { status: 400 })
  }

  try {
    const [city, result] = await Promise.all([
      getAvailableCity(slug),
      getAvailableCityRuleResult(slug),
    ])
    if (!city || !result.rule) {
      return NextResponse.json({ message: '暂未找到该城市的社保公积金规则。' }, { status: 404 })
    }

    return NextResponse.json({
      city,
      rule: stripRuleSources(result.rule),
      source: result.source,
      fallbackReason: result.fallbackReason,
    })
  } catch (error) {
    console.warn(`读取城市规则接口失败：${slug}。`, error)
    return NextResponse.json({ message: '暂时无法读取城市规则。' }, { status: 500 })
  }
}

function stripRuleSources(rule: CityRule): Record<string, unknown> {
  return Object.fromEntries(Object.entries(rule)
    .filter(([key]) => key !== 'sources')
    .map(([key, value]) => [
      key,
      key === 'policyVersions' && Array.isArray(value)
        ? (value as CityRule[]).map((version) => stripRuleSources(version))
        : value,
    ]))
}
