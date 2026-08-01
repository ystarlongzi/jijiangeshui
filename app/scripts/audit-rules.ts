import { cityRules, type CityRule } from '../src/lib/tax-rules'

/**
 * 审计前台兜底城市规则。
 *
 * 这个脚本检查的是写在代码里的 fallback cityRules，不访问数据库。
 * 它适合在修改城市基数、比例、来源信息后快速跑一遍，确认：
 * - 生效日期、核对日期、来源是否完整
 * - 社保/公积金基数范围是否合法
 * - 是否包含社保项目和公积金项目
 * - 公积金比例选项是否覆盖常见 3%-12%
 */
type Severity = 'error' | 'warning'
type IssueCategory = 'source' | 'baseRule' | 'itemRule' | 'housingRate'

type AuditIssue = {
  city: string
  category: IssueCategory
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

function createIssue(city: string, category: IssueCategory, severity: Severity, message: string): AuditIssue {
  return { city, category, severity, message }
}

function getRuleIssues(code: string, rule: CityRule): AuditIssue[] {
  const issues: AuditIssue[] = []
  // checkedAt 是我们向用户展示“规则核对日期”的依据，优先选带 checkedAt 的来源。
  const source = rule.sources.find((item) => item.checkedAt) || rule.sources[0]
  const housingItem = rule.contributionItems.find((item) => item.housing || item.systemType === 'housingFund')
  const socialItems = rule.contributionItems.filter((item) => item.systemType === 'social')

  if (!rule.effective) issues.push(createIssue(code, 'source', 'error', '缺少规则生效日期'))
  if (!rule.sources.length) issues.push(createIssue(code, 'source', 'error', '缺少规则来源'))
  if (!source?.checkedAt) issues.push(createIssue(code, 'source', 'error', '缺少规则核对日期'))
  if (rule.sources.some((item) => !item.url)) issues.push(createIssue(code, 'source', 'warning', '存在未配置 URL 的规则来源'))

  for (const baseRule of Object.values(rule.baseRules)) {
    // 基数范围错误会直接导致工资计算错误，所以这里按 error 处理。
    if (baseRule.min <= 0 || baseRule.max <= 0) {
      issues.push(createIssue(code, 'baseRule', 'error', `${baseRule.label}范围必须大于 0`))
    }
    if (baseRule.min > baseRule.max) {
      issues.push(createIssue(code, 'baseRule', 'error', `${baseRule.label}下限不能大于上限`))
    }
  }

  if (!socialItems.length) issues.push(createIssue(code, 'itemRule', 'error', '缺少社保缴费项目'))
  if (!housingItem) issues.push(createIssue(code, 'itemRule', 'error', '缺少公积金缴费项目'))
  // 公积金比例在产品里允许用户选择，缺少边界选项会让表单能力不完整。
  if (!rule.housingRateOptions.includes(3) || !rule.housingRateOptions.includes(12)) {
    issues.push(createIssue(code, 'housingRate', 'warning', '公积金比例选项未覆盖 3%-12%'))
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
const categorySummary = issues.reduce(
  (summary, issue) => {
    summary[issue.category] += 1
    return summary
  },
  { source: 0, baseRule: 0, itemRule: 0, housingRate: 0 } satisfies Record<IssueCategory, number>,
)

function printIssueGroup(category: IssueCategory, label: string) {
  const group = issues.filter((issue) => issue.category === category)
  if (!group.length) return

  console.log(`\n${label}：`)
  for (const issue of group) {
    console.log(`[${issue.severity}] ${issue.city}: ${issue.message}`)
  }
}

if (useJson) {
  // JSON 输出方便后续接入 CI、报表或后台任务。
  console.log(
    JSON.stringify(
      {
        rows,
        issues,
        summary: {
          cities: rows.length,
          errors: errorCount,
          warnings: warningCount,
          categories: categorySummary,
        },
      },
      null,
      2,
    ),
  )
} else {
  console.table(rows)
  if (issues.length) {
    printIssueGroup('source', '来源问题')
    printIssueGroup('baseRule', '基数问题')
    printIssueGroup('itemRule', '缴费项目问题')
    printIssueGroup('housingRate', '公积金比例问题')
  }
  console.log(
    `\n完成：${rows.length} 个城市，${errorCount} 个错误，${warningCount} 个提醒。` +
      ` 来源 ${categorySummary.source}，基数 ${categorySummary.baseRule}，项目 ${categorySummary.itemRule}，公积金比例 ${categorySummary.housingRate}。`,
  )
}

if (errorCount > 0 || (strict && warningCount > 0)) {
  // 默认只有 error 让脚本失败；--strict 会把 warning 也当成失败。
  process.exitCode = 1
}
