import assert from 'node:assert/strict'
import test from 'node:test'

import { auditCityRule, getCityRuleStats, getRuleQualityStatus, hasRuleSourceUrl } from './city-rule-quality'
import { cityRules, type CityRule } from './tax-rules'

test('城市规则质量：缺少来源 URL 时给出提醒但不阻断', () => {
  const issues = auditCityRule('beijing', cityRules.beijing)

  assert.equal(getRuleQualityStatus(issues), 'warning')
  assert.equal(issues.some((issue) => issue.category === 'source' && issue.severity === 'warning'), true)
  assert.equal(hasRuleSourceUrl(cityRules.beijing), false)
})

test('城市规则质量：基数范围异常时标记为错误', () => {
  const brokenRule: CityRule = {
    ...cityRules.beijing,
    baseRules: {
      ...cityRules.beijing.baseRules,
      social: { ...cityRules.beijing.baseRules.social, min: 40000, max: 30000 },
    },
  }
  const issues = auditCityRule('beijing', brokenRule)

  assert.equal(getRuleQualityStatus(issues), 'error')
  assert.equal(issues.some((issue) => issue.category === 'baseRule' && issue.severity === 'error'), true)
})

test('城市规则统计：汇总当年规则和来源覆盖情况', () => {
  const stats = getCityRuleStats(Object.entries(cityRules), 2026)

  assert.equal(stats.total, 5)
  assert.equal(stats.currentYearRules, 5)
  assert.equal(stats.withSourceUrl, 0)
  assert.equal(stats.missingSourceUrl, 5)
  assert.equal(stats.warnings, 5)
})
