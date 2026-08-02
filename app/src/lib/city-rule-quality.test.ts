import assert from 'node:assert/strict'
import test from 'node:test'

import {
  auditCityRule,
  getCityRuleStats,
  getRuleFreshnessLabel,
  getRuleFreshnessStatus,
  getRuleQualityStatus,
  hasRuleSourceUrl,
} from './city-rule-quality'
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
  assert.equal(stats.usableRules, 5)
  assert.equal(stats.withSourceUrl, 0)
  assert.equal(stats.missingSourceUrl, 5)
  assert.equal(stats.sourceUrlCoverageRate, 0)
  assert.equal(stats.warnings, 5)
})

test('城市规则核对新鲜度：按核对日期判断是否需要复核', () => {
  const now = new Date('2026-08-02T12:00:00+08:00')

  assert.equal(getRuleFreshnessStatus('2026-07-01', now), 'fresh')
  assert.equal(getRuleFreshnessStatus('2025-12-01', now), 'stale')
  assert.equal(getRuleFreshnessStatus('', now), 'missing')
  assert.equal(getRuleFreshnessStatus('bad-date', now), 'missing')
})

test('城市规则核对新鲜度：输出前台展示文案', () => {
  assert.equal(getRuleFreshnessLabel('fresh'), '近期核对')
  assert.equal(getRuleFreshnessLabel('stale'), '需要复核')
  assert.equal(getRuleFreshnessLabel('missing'), '缺少核对')
})
