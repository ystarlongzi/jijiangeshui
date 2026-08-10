const citySlugAliases: Record<string, string> = {
  // Hrwork 的深圳编码是 shenzhenszzf，前台和兜底规则统一使用 shenzhen。
  shenzhenszzf: 'shenzhen',
}

export function canonicalCitySlug(value: string) {
  const normalized = value.trim().toLowerCase()
  return citySlugAliases[normalized] || normalized
}

export function isCitySlugAlias(value: string) {
  const normalized = value.trim().toLowerCase()
  return canonicalCitySlug(normalized) !== normalized
}
