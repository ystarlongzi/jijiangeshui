import assert from 'node:assert/strict'
import test from 'node:test'
import type { CityRule } from '@/lib/tax-rules'
import { countCityRuleSources, getCityRuleSourceBadgeLabel, getCityRuleSourceCoverage, getCityRuleSourceStatus, getPreferredCityRuleLinks } from './cityRuleSource'

test('returns public status for cities backed by managed rules', () => {
  const status = getCityRuleSourceStatus({
    city: 'beijing',
    ruleDatasetSummary: {
      sourceDetail: '已从后台规则读取 2 个有效城市',
      sourceLabel: '后台规则',
    },
    ruleSourcesByCity: { beijing: 'payload' },
  })

  assert.equal(status.source, 'payload')
  assert.equal(status.label, '已收录规则')
  assert.equal(status.detail, '已收录城市规则')
})

test('returns dataset fallback detail when the whole dataset is fallback', () => {
  const status = getCityRuleSourceStatus({
    city: 'beijing',
    ruleDatasetSummary: {
      sourceDetail: '未配置 DATABASE_URI，使用内置城市规则',
      sourceLabel: '默认规则',
    },
  })

  assert.equal(status.source, 'fallback')
  assert.equal(status.label, '规则待补')
  assert.equal(status.detail, '使用默认城市规则')
})

test('returns city-level fallback detail when managed rules are available but a city is not backed by them', () => {
  const status = getCityRuleSourceStatus({
    city: 'hangzhou',
    ruleDatasetSummary: {
      sourceDetail: '已从后台规则读取 2 个有效城市',
      sourceLabel: '后台规则',
    },
    ruleSourcesByCity: { beijing: 'payload', hangzhou: 'fallback' },
  })

  assert.equal(status.source, 'fallback')
  assert.equal(status.label, '规则待补')
  assert.equal(status.detail, '当前城市规则待补充')
})

test('counts managed and fallback city rule sources', () => {
  const counts = countCityRuleSources(['beijing', 'shanghai', 'hangzhou'], {
    beijing: 'payload',
    shanghai: 'payload',
  })

  assert.deepEqual(counts, { fallback: 1, payload: 2 })
})

test('calculates managed city rule coverage rate', () => {
  const coverage = getCityRuleSourceCoverage(['beijing', 'shanghai', 'hangzhou', 'guangzhou'], {
    beijing: 'payload',
    shanghai: 'payload',
    hangzhou: 'payload',
  })

  assert.deepEqual(coverage, { fallback: 1, payload: 3, payloadRate: 75, total: 4 })
})

test('returns short labels for city rule sources', () => {
  assert.equal(getCityRuleSourceBadgeLabel('payload'), '已收录')
  assert.equal(getCityRuleSourceBadgeLabel('fallback'), '待补')
})

test('builds preferred city links and skips unavailable cities', () => {
  const links = getPreferredCityRuleLinks({
    preferredCityKeys: ['beijing', 'missing', 'hangzhou'],
    ruleSourcesByCity: { beijing: 'payload' },
    rules: {
      beijing: { label: '北京市' } as CityRule,
      hangzhou: { label: '杭州市' } as CityRule,
    },
  })

  assert.deepEqual(links, [
    { key: 'beijing', label: '北京市', sourceLabel: '已收录', sourceType: 'payload' },
    { key: 'hangzhou', label: '杭州市', sourceLabel: '待补', sourceType: 'fallback' },
  ])
})
