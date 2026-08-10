import assert from 'node:assert/strict'
import test from 'node:test'

import { summarizeSpecialDeductionRules, type SpecialDeductionRuleDoc } from './special-deduction-rule-quality'

const requiredTypes = ['childEducation', 'infantCare', 'continuingEducation', 'housingLoanInterest', 'housingRent', 'elderlyCare']

function createDoc(deductionType: string, overrides: Partial<SpecialDeductionRuleDoc> = {}): SpecialDeductionRuleDoc {
  return {
    id: deductionType,
    ruleYear: 2026,
    deductionType,
    monthlyAmount: 1000,
    maxMonthlyAmount: 2000,
    allocationOptions: [{ label: '默认方案', monthlyAmount: 1000, sortOrder: 1 }],
    effectiveFrom: '2026-01-01',
    ruleStatus: 'active',
    source: { url: 'https://example.com/rule', checkedAt: '2026-01-01' },
    warnings: [],
    ...overrides,
  }
}

test('专项附加扣除规则：六项 active 且结构完整时通过 strict 验收', () => {
  const summary = summarizeSpecialDeductionRules(requiredTypes.map((type) => createDoc(type)), 2026)
  assert.equal(summary.ready, true)
  assert.equal(summary.activeRequired, 6)
})

test('专项附加扣除规则：缺项、重复、来源和金额结构问题会阻断验收', () => {
  const docs = requiredTypes
    .filter((type) => type !== 'housingRent')
    .map((type) => createDoc(type))
  docs.push(createDoc('childEducation', { id: 'duplicate', source: undefined, allocationOptions: [], monthlyAmount: 3000, maxMonthlyAmount: 2000 }))
  const summary = summarizeSpecialDeductionRules(docs, 2026)

  assert.equal(summary.ready, false)
  assert.deepEqual(summary.missing, ['住房租金'])
  assert.equal(summary.duplicates.length, 1)
  assert.equal(summary.sourceGaps.length, 1)
  assert.ok(summary.shapeGaps.length >= 2)
})
