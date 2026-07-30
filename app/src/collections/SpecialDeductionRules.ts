import type { CollectionConfig } from 'payload'

const deductionTypeOptions = [
  { label: '子女教育', value: 'childEducation' },
  { label: '3 岁以下婴幼儿照护', value: 'infantCare' },
  { label: '继续教育', value: 'continuingEducation' },
  { label: '住房贷款利息', value: 'housingLoanInterest' },
  { label: '住房租金', value: 'housingRent' },
  { label: '赡养老人', value: 'elderlyCare' },
]

export const SpecialDeductionRules: CollectionConfig = {
  slug: 'special-deduction-rules',
  dbName: 'sdr',
  labels: {
    singular: '专项附加扣除规则',
    plural: '专项附加扣除规则',
  },
  admin: {
    useAsTitle: 'ruleTitle',
    defaultColumns: ['ruleTitle', 'ruleYear', 'deductionType', 'monthlyAmount', 'ruleStatus'],
    description: '维护专项附加扣除标准、适用条件和分摊方式。',
  },
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.ruleStatus !== 'active') return data

        if (data.warnings?.length) {
          throw new Error('存在解析警告，先处理警告后才能发布为有效规则。')
        }

        const monthlyAmount = data.monthlyAmount ?? 0
        const maxMonthlyAmount = data.maxMonthlyAmount ?? monthlyAmount
        if (monthlyAmount > maxMonthlyAmount) {
          throw new Error('默认月扣除额不能大于最高月扣除额。')
        }

        return data
      },
    ],
  },
  fields: [
    { name: 'ruleTitle', label: '规则名称', type: 'text', required: true },
    { name: 'ruleYear', label: '规则年度', type: 'number', required: true, min: 2000, max: 2100 },
    {
      name: 'deductionType',
      label: '扣除项目',
      type: 'select',
      options: deductionTypeOptions,
      required: true,
    },
    { name: 'monthlyAmount', label: '默认月扣除额', type: 'number', required: true, min: 0 },
    { name: 'maxMonthlyAmount', label: '最高月扣除额', type: 'number', min: 0 },
    { name: 'annualAmount', label: '年度扣除额', type: 'number', min: 0 },
    {
      name: 'amountUnit',
      label: '金额单位',
      type: 'select',
      defaultValue: 'monthly',
      options: [
        { label: '按月', value: 'monthly' },
        { label: '按年', value: 'annual' },
        { label: '一次性', value: 'oneTime' },
      ],
      required: true,
    },
    {
      name: 'allocationOptions',
      label: '分摊或选择方案',
      type: 'array',
      dbName: 'allocs',
      fields: [
        { name: 'label', label: '方案名称', type: 'text', required: true },
        { name: 'monthlyAmount', label: '月扣除额', type: 'number', required: true, min: 0 },
        { name: 'description', label: '说明', type: 'textarea' },
        { name: 'sortOrder', label: '显示顺序', type: 'number', defaultValue: 10 },
      ],
    },
    {
      name: 'conditions',
      label: '适用条件',
      type: 'group',
      fields: [
        { name: 'summary', label: '条件摘要', type: 'textarea' },
        { name: 'requiresProof', label: '需要留存凭证', type: 'checkbox', defaultValue: true },
        { name: 'canShareWithSpouse', label: '可与配偶分摊', type: 'checkbox', defaultValue: false },
        { name: 'exclusiveWith', label: '互斥项目说明', type: 'textarea' },
      ],
    },
    {
      name: 'effectiveFrom',
      label: '生效日期',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'effectiveTo',
      label: '失效日期',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'ruleStatus',
      label: '业务状态',
      type: 'select',
      defaultValue: 'pendingReview',
      options: [
        { label: '待审核', value: 'pendingReview' },
        { label: '有效', value: 'active' },
        { label: '已归档', value: 'archived' },
      ],
      required: true,
    },
    {
      name: 'source',
      label: '规则来源',
      type: 'group',
      fields: [
        { name: 'title', label: '来源标题', type: 'text' },
        { name: 'url', label: '来源链接', type: 'text' },
        { name: 'checkedAt', label: '核对日期', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
        { name: 'remark', label: '备注', type: 'textarea' },
      ],
    },
    {
      name: 'warnings',
      label: '解析警告',
      type: 'array',
      fields: [{ name: 'message', label: '警告内容', type: 'text', required: true }],
    },
    { name: 'rawData', label: '原始数据', type: 'json' },
  ],
}
