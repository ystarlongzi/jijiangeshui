import { NextResponse } from 'next/server'

type ReverseGeocodeResponse = {
  display_name?: string
  address?: {
    city?: string
    city_district?: string
    town?: string
    county?: string
    municipality?: string
    state?: string
    province?: string
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const latitude = Number(url.searchParams.get('lat'))
  const longitude = Number(url.searchParams.get('lon'))

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ message: '定位坐标无效。' }, { status: 400 })
  }

  const endpoint = new URL('https://nominatim.openstreetmap.org/reverse')
  endpoint.searchParams.set('format', 'jsonv2')
  endpoint.searchParams.set('lat', String(latitude))
  endpoint.searchParams.set('lon', String(longitude))
  endpoint.searchParams.set('zoom', '10')
  endpoint.searchParams.set('accept-language', 'zh-CN')

  try {
    // 反向地理编码只在用户点击“自动定位”时调用，使用服务端代理避免浏览器跨域和暴露实现细节。
    const response = await fetch(endpoint, {
      headers: { 'User-Agent': 'JijianGeshui/0.1 (location lookup)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return NextResponse.json({ message: '暂时无法解析定位城市。' }, { status: 502 })

    const data = await response.json() as ReverseGeocodeResponse
    const address = data.address || {}
    const displayName = data.display_name || ''
    const city = inferPrefectureCity(address, displayName)
    const province = address.state || address.province || ''
    if (!city) return NextResponse.json({ message: '定位结果中没有可识别的城市。' }, { status: 404 })

    return NextResponse.json({ city, province, displayName: displayName || city })
  } catch (error) {
    console.warn('反向地理编码失败。', error)
    return NextResponse.json({ message: '暂时无法解析定位城市。' }, { status: 502 })
  }
}

function inferPrefectureCity(address: NonNullable<ReverseGeocodeResponse['address']>, displayName: string) {
  // Nominatim 在杭州余杭区可能把 county/city 返回为“余杭区”，但 display_name 仍包含“杭州市”。
  // 优先使用地址串中明确的地级市，避免拿区县直接匹配社保规则。
  const displayCity = displayName
    .split(/[，,]/u)
    .map((part) => part.trim())
    .find((part) => /(?:特别行政区|自治州|地区|盟|市)$/u.test(part))

  return displayCity || address.municipality || address.city || address.town || address.county || address.city_district || ''
}
