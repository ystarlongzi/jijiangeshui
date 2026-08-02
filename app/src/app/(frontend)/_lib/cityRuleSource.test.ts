import assert from 'node:assert/strict'
import test from 'node:test'
import type { CityRule } from '@/lib/tax-rules'
import { countCityRuleSources, getCityRuleSourceStatus, getPreferredCityRuleLinks } from './cityRuleSource'

test('returns Payload CMS status for cities backed by CMS rules', () => {
  const status = getCityRuleSourceStatus({
    city: 'beijing',
    ruleDatasetSummary: {
      sourceDetail: '已从 Payload CMS 读取 2 个有效城市',
      sourceLabel: 'Payload CMS',
    },
    ruleSourcesByCity: { beijing: 'payload' },
  })

  assert.equal(status.source, 'payload')
  assert.equal(status.label, 'Payload CMS')
  assert.equal(status.detail, '已从 Payload CMS 读取 2 个有效城市')
})

test('returns dataset fallback detail when the whole dataset is fallback', () => {
  const status = getCityRuleSourceStatus({
    city: 'beijing',
    ruleDatasetSummary: {
      sourceDetail: '未配置 DATABASE_URI，使用内置城市规则',
      sourceLabel: '内置兜底',
    },
  })

  assert.equal(status.source, 'fallback')
  assert.equal(status.label, '内置兜底')
  assert.equal(status.detail, '未配置 DATABASE_URI，使用内置城市规则')
})

test('returns city-level fallback detail when CMS is available but a city is not backed by CMS', () => {
  const status = getCityRuleSourceStatus({
    city: 'hangzhou',
    ruleDatasetSummary: {
      sourceDetail: '已从 Payload CMS 读取 2 个有效城市',
      sourceLabel: 'Payload CMS',
    },
    ruleSourcesByCity: { beijing: 'payload', hangzhou: 'fallback' },
  })

  assert.equal(status.source, 'fallback')
  assert.equal(status.label, '内置兜底')
  assert.equal(status.detail, '当前城市暂无后台有效规则')
})

test('counts Payload CMS and fallback city rule sources', () => {
  const counts = countCityRuleSources(['beijing', 'shanghai', 'hangzhou'], {
    beijing: 'payload',
    shanghai: 'payload',
  })

  assert.deepEqual(counts, { fallback: 1, payload: 2 })
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
    { key: 'beijing', label: '北京市', sourceLabel: 'CMS', sourceType: 'payload' },
    { key: 'hangzhou', label: '杭州市', sourceLabel: '兜底', sourceType: 'fallback' },
  ])
})
