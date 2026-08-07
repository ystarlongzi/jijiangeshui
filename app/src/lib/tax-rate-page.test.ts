import assert from 'node:assert/strict'
import test from 'node:test'

import { currentYear } from './site'
import { getTaxRatePageSeo, getTaxRateSeoSelections, getTaxRateUrl, parseTaxRateSelection } from './tax-rate-page'

test('税率表 URL 可以恢复非居民劳务报酬 tab', () => {
  const selection = parseTaxRateSelection({ type: 'labor', identity: 'non-resident', year: String(currentYear) }, [currentYear])

  assert.deepEqual(selection, { type: 'labor', identity: 'non-resident', year: currentYear })
  assert.equal(getTaxRateUrl(selection, currentYear), `/tax-rate?type=labor&identity=non-resident&year=${currentYear}`)
  assert.match(getTaxRatePageSeo(selection).title, /劳务报酬/)
})

test('分类所得 URL 会忽略居民身份参数并保留经营所得年度', () => {
  const selection = parseTaxRateSelection({ type: 'business', identity: 'non-resident', year: String(currentYear) }, [currentYear])

  assert.deepEqual(selection, { type: 'business', identity: 'resident', year: currentYear })
  assert.equal(getTaxRateUrl(selection, currentYear), `/tax-rate?type=business&year=${currentYear}`)
})

test('默认居民工资 tab 使用干净的税率表 URL', () => {
  const selection = parseTaxRateSelection({}, [currentYear])

  assert.equal(getTaxRateUrl(selection, currentYear), '/tax-rate')
})

test('税率页 SEO 入口覆盖综合所得两类身份和分类所得', () => {
  const selections = getTaxRateSeoSelections(currentYear)

  assert.equal(selections.length, 13)
  assert.equal(selections.filter((item) => item.identity === 'non-resident').length, 4)
  assert.equal(selections.filter((item) => item.type === 'business').length, 1)
})
