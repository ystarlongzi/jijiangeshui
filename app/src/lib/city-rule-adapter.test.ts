import assert from 'node:assert/strict'
import test from 'node:test'

import { adaptCmsPolicyToCityRule } from './city-rule-adapter'

test('Payload 社保规则：小数比例转换为前端计算使用的百分数', () => {
  const rule = adaptCmsPolicyToCityRule(
    {
      policyYear: 2026,
      effectiveFrom: '2026-07-01',
      source: { title: '北京市规则', checkedAt: '2026-07-27' },
      baseRules: [
        { baseType: 'social', baseMin: 6326, baseMax: 31884 },
        { baseType: 'housingFund', baseMin: 2420, baseMax: 31884 },
      ],
      itemRules: [
        {
          systemType: 'social',
          itemCode: 'pension',
          itemName: '养老保险',
          baseType: 'social',
          employee: { calcMethod: 'rate', rate: 0.08 },
          employer: { calcMethod: 'rate', rate: 0.16 },
          sortOrder: 10,
        },
        {
          systemType: 'social',
          itemCode: 'medical',
          itemName: '医疗保险',
          baseType: 'social',
          employee: { calcMethod: 'rate', rate: 0.02 },
          employer: { calcMethod: 'rate', rate: 0.095 },
          sortOrder: 20,
        },
        {
          systemType: 'housingFund',
          itemCode: 'housing-fund',
          itemName: '公积金',
          baseType: 'housingFund',
          employee: { calcMethod: 'rate', rate: 0.12 },
          employer: { calcMethod: 'rate', rate: 0.12 },
          sortOrder: 30,
        },
        {
          systemType: 'employerCost',
          itemCode: 'union-fee',
          itemName: '工会经费',
          baseType: 'none',
          employer: { calcMethod: 'rate', rate: 0.02 },
          sortOrder: 40,
        },
      ],
    },
    { name: '北京市', slug: 'beijing', provinceName: '北京' },
  )

  assert.equal(rule.label, '北京市')
  assert.equal(rule.effective, '2026-07-01')
  assert.equal(rule.socialMin, 6326)
  assert.equal(rule.housingMax, 31884)
  assert.equal(rule.socialEmployee, 8)
  assert.equal(rule.socialEmployer, 16)
  assert.equal(rule.medicalEmployee, 2)
  assert.equal(rule.medicalEmployer, 9.5)
  assert.equal(rule.contributionItems.length, 3)
  assert.equal(rule.contributionItems[2]?.housing, true)
})
