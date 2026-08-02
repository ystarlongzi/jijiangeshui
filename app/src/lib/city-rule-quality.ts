import type { CityRule } from './tax-rules'

export type RuleQualitySeverity = 'error' | 'warning'
export type RuleQualityCategory = 'source' | 'baseRule' | 'itemRule' | 'housingRate'

export type RuleQualityIssue = {
  city: string
  category: RuleQualityCategory
  severity: RuleQualitySeverity
  message: string
}

export type RuleQualityStatus = 'ok' | 'warning' | 'error'
export type RuleFreshnessStatus = 'fresh' | 'stale' | 'missing'

export type CityRuleStats = {
  total: number
  currentYearRules: number
  usableRules: number
  withSourceUrl: number
  missingSourceUrl: number
  sourceUrlCoverageRate: number
  errors: number
  warnings: number
}

// 同一个城市可能有多个来源。前台展示和审计摘要优先使用带 checkedAt 的来源，
// 因为它能说明“这条规则最近一次被核对到什么时候”。
export function getPrimaryRuleSource(rule: CityRule) {
  return rule.sources.find((source) => source.checkedAt) || rule.sources[0]
}

export function hasRuleSourceUrl(rule: CityRule) {
  return rule.sources.some((source) => Boolean(source.url))
}

export function getRuleFreshnessStatus(checkedAt?: string, now = new Date(), staleDays = 180): RuleFreshnessStatus {
  if (!checkedAt) return 'missing'
  const checkedDate = new Date(`${checkedAt}T00:00:00+08:00`)
  if (Number.isNaN(checkedDate.getTime())) return 'missing'

  const diffDays = Math.floor((now.getTime() - checkedDate.getTime()) / 86400000)
  return diffDays > staleDays ? 'stale' : 'fresh'
}

export function getRuleFreshnessLabel(status: RuleFreshnessStatus) {
  if (status === 'fresh') return '近期核对'
  if (status === 'stale') return '需要复核'
  return '缺少核对'
}

export function getRuleQualityStatus(issues: RuleQualityIssue[]): RuleQualityStatus {
  if (issues.some((issue) => issue.severity === 'error')) return 'error'
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning'
  return 'ok'
}

// 质量审计分为 error 和 warning：
// - error：会影响计算是否可信，例如缺基数、缺缴费项目、缺核对日期
// - warning：不一定阻断计算，但需要后续补齐，例如来源没有 URL
export function auditCityRule(code: string, rule: CityRule): RuleQualityIssue[] {
  const issues: RuleQualityIssue[] = []
  const source = getPrimaryRuleSource(rule)
  const housingItem = rule.contributionItems.find((item) => item.housing || item.systemType === 'housingFund')
  const socialItems = rule.contributionItems.filter((item) => item.systemType === 'social')

  if (!rule.effective) issues.push(createIssue(code, 'source', 'error', '缺少规则生效日期'))
  if (!rule.sources.length) issues.push(createIssue(code, 'source', 'error', '缺少规则来源'))
  if (!source?.checkedAt) issues.push(createIssue(code, 'source', 'error', '缺少规则核对日期'))
  if (rule.sources.some((item) => !item.url)) issues.push(createIssue(code, 'source', 'warning', '存在未配置 URL 的规则来源'))

  for (const baseRule of Object.values(rule.baseRules)) {
    if (baseRule.min <= 0 || baseRule.max <= 0) {
      issues.push(createIssue(code, 'baseRule', 'error', `${baseRule.label}范围必须大于 0`))
    }
    if (baseRule.min > baseRule.max) {
      issues.push(createIssue(code, 'baseRule', 'error', `${baseRule.label}下限不能大于上限`))
    }
  }

  if (!socialItems.length) issues.push(createIssue(code, 'itemRule', 'error', '缺少社保缴费项目'))
  if (!housingItem) issues.push(createIssue(code, 'itemRule', 'error', '缺少公积金缴费项目'))
  if (!rule.housingRateOptions.includes(3) || !rule.housingRateOptions.includes(12)) {
    issues.push(createIssue(code, 'housingRate', 'warning', '公积金比例选项未覆盖 3%-12%'))
  }

  return issues
}

export function getCityRuleStats(cities: Array<[string, CityRule]>, year: number): CityRuleStats {
  const issues = cities.flatMap(([code, rule]) => auditCityRule(code, rule))
  const usableRules = cities.filter(([code, rule]) => getRuleQualityStatus(auditCityRule(code, rule)) !== 'error').length
  const withSourceUrl = cities.filter(([, rule]) => hasRuleSourceUrl(rule)).length

  return {
    total: cities.length,
    currentYearRules: cities.filter(([, rule]) => rule.effective.startsWith(String(year))).length,
    usableRules,
    withSourceUrl,
    missingSourceUrl: cities.length - withSourceUrl,
    sourceUrlCoverageRate: cities.length > 0 ? Math.round((withSourceUrl / cities.length) * 100) : 0,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
  }
}

function createIssue(
  city: string,
  category: RuleQualityCategory,
  severity: RuleQualitySeverity,
  message: string,
): RuleQualityIssue {
  return { city, category, severity, message }
}
