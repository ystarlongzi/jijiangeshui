import { cityRules, type CityRule } from '../src/lib/tax-rules'

type Severity = 'error' | 'warning'

type AuditIssue = {
  city: string
  severity: Severity
  message: string
}

type AuditRow = {
  code: string
  city: string
  effective: string
  checkedAt: string
  socialBase: string
  housingBase: string
  housingRates: string
  sources: number
  status: 'ok' | 'warning' | 'error'
}

const useJson = process.argv.includes('--json')
const strict = process.argv.includes('--strict')

function formatRange(min: number, max: number) {
  return `${min}-${max}`
}

function getRuleIssues(code: string, rule: CityRule): AuditIssue[] {
  const issues: AuditIssue[] = []
  const source = rule.sources.find((item) => item.checkedAt) || rule.sources[0]
  const housingItem = rule.contributionItems.find((item) => item.housing || item.systemType === 'housingFund')
  const socialItems = rule.contributionItems.filter((item) => item.systemType === 'social')

  if (!rule.effective) issues.push({ city: code, severity: 'error', message: '缺少规则生效日期' })
  if (!rule.sources.length) issues.push({ city: code, severity: 'error', message: '缺少规则来源' })
  if (!source?.checkedAt) issues.push({ city: code, severity: 'error', message: '缺少规则核对日期' })
  if (rule.sources.some((item) => !item.url)) issues.push({ city: code, severity: 'warning', message: '存在未配置 URL 的规则来源' })

  for (const baseRule of Object.values(rule.baseRules)) {
    if (baseRule.min <= 0 || baseRule.max <= 0) {
      issues.push({ city: code, severity: 'error', message: `${baseRule.label}范围必须大于 0` })
    }
    if (baseRule.min > baseRule.max) {
      issues.push({ city: code, severity: 'error', message: `${baseRule.label}下限不能大于上限` })
    }
  }

  if (!socialItems.length) issues.push({ city: code, severity: 'error', message: '缺少社保缴费项目' })
  if (!housingItem) issues.push({ city: code, severity: 'error', message: '缺少公积金缴费项目' })
  if (!rule.housingRateOptions.includes(3) || !rule.housingRateOptions.includes(12)) {
    issues.push({ city: code, severity: 'warning', message: '公积金比例选项未覆盖 3%-12%' })
  }

  return issues
}

function getStatus(issues: AuditIssue[]): AuditRow['status'] {
  if (issues.some((issue) => issue.severity === 'error')) return 'error'
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning'
  return 'ok'
}

function createRow(code: string, rule: CityRule, issues: AuditIssue[]): AuditRow {
  const checkedAt = rule.sources.find((source) => source.checkedAt)?.checkedAt || ''

  return {
    code,
    city: rule.label,
    effective: rule.effective,
    checkedAt,
    socialBase: formatRange(rule.baseRules.social.min, rule.baseRules.social.max),
    housingBase: formatRange(rule.baseRules.housingFund.min, rule.baseRules.housingFund.max),
    housingRates: rule.housingRateOptions.map((rate) => `${rate}%`).join('/'),
    sources: rule.sources.length,
    status: getStatus(issues),
  }
}

const entries = Object.entries(cityRules)
const issues = entries.flatMap(([code, rule]) => getRuleIssues(code, rule))
const rows = entries.map(([code, rule]) => createRow(code, rule, issues.filter((issue) => issue.city === code)))
const errorCount = issues.filter((issue) => issue.severity === 'error').length
const warningCount = issues.filter((issue) => issue.severity === 'warning').length

if (useJson) {
  console.log(JSON.stringify({ rows, issues, summary: { cities: rows.length, errors: errorCount, warnings: warningCount } }, null, 2))
} else {
  console.table(rows)
  if (issues.length) {
    console.log('\n规则问题：')
    for (const issue of issues) {
      console.log(`[${issue.severity}] ${issue.city}: ${issue.message}`)
    }
  }
  console.log(`\n完成：${rows.length} 个城市，${errorCount} 个错误，${warningCount} 个提醒。`)
}

if (errorCount > 0 || (strict && warningCount > 0)) {
  process.exitCode = 1
}
