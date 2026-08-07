import { NextResponse } from 'next/server'

import { getAvailableCities } from '@/lib/city-rule-service'

const MAX_SUGGESTION_LIMIT = 20

export async function GET(request: Request) {
  const url = new URL(request.url)
  const keyword = (url.searchParams.get('keyword') || '').trim().slice(0, 50)
  const all = url.searchParams.get('all') === 'true'
  const requestedLimit = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_SUGGESTION_LIMIT)
    : MAX_SUGGESTION_LIMIT

  try {
    const cities = await getAvailableCities({ keyword, limit, all })
    return NextResponse.json({ items: cities, total: cities.length })
  } catch (error) {
    console.warn('读取城市列表接口失败。', error)
    return NextResponse.json({ message: '暂时无法读取城市列表。' }, { status: 500 })
  }
}
