import type { CollectionConfig } from 'payload'

const incomeTypeOptions = [
  { label: '工资薪金', value: 'salary' },
  { label: '劳务报酬', value: 'labor' },
  { label: '稿酬', value: 'author' },
  { label: '特许权使用费', value: 'license' },
  { label: '经营所得', value: 'business' },
  { label: '财产租赁', value: 'rental' },
  { label: '财产转让', value: 'transfer' },
  { label: '利息股息红利', value: 'dividend' },
  { label: '偶然所得', value: 'accidental' },
]

export const TaxRateRules: CollectionConfig = {
  slug: 'tax-rate-rules',
  dbName: 'trr',
  defaultSort: ['ruleYear', 'incomeCategory', 'incomeType'],
  labels: {
    singular: '税率规则',
    plural: '税率规则',
  },
  admin: {
    useAsTitle: 'ruleTitle',
    group: '规则数据',
    defaultColumns: ['ruleTitle', 'ruleYear', 'incomeType', 'taxpayerIdentity', 'ruleStatus'],
    listSearchableFields: ['ruleTitle', 'source.title', 'source.url', 'note'],
    description: '维护个人所得税税率表、预扣率表和比例税率规则。',
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

        const rows = data.tableRows || []
        if (data.rateMode === 'table' && rows.length === 0) {
          throw new Error('表格税率规则至少需要一行税率区间。')
        }

        const invalidRow = rows.some((row: { lowerBound?: number; upperBound?: number }) => {
          if (row.upperBound === undefined || row.upperBound === null) return false
          return (row.lowerBound ?? 0) >= row.upperBound
        })
        if (invalidRow) {
          throw new Error('税率区间的下限必须小于上限。')
        }

        return data
      },
    ],
  },
  fields: [
    { name: 'ruleTitle', label: '规则名称', type: 'text', required: true },
    { name: 'ruleYear', label: '规则年度', type: 'number', required: true, min: 2000, max: 2100, admin: { description: '用于税率表页面和各计算器按年份取数。' } },
    {
      name: 'incomeCategory',
      label: '所得大类',
      type: 'select',
      admin: {
        description: '综合所得包含工资薪金、劳务报酬、稿酬、特许权使用费；分类所得不再区分居民和非居民 tab。',
      },
      options: [
        { label: '综合所得', value: 'comprehensive' },
        { label: '分类所得', value: 'classified' },
      ],
      required: true,
    },
    {
      name: 'incomeType',
      label: '所得类型',
      type: 'select',
      options: incomeTypeOptions,
      required: true,
    },
    {
      name: 'taxpayerIdentity',
      label: '纳税身份',
      type: 'select',
      defaultValue: 'notApplicable',
      admin: {
        description: '分类所得请选择“不区分”；综合所得按规则选择居民个人或非居民个人。',
      },
      options: [
        { label: '不区分', value: 'notApplicable' },
        { label: '居民个人', value: 'resident' },
        { label: '非居民个人', value: 'nonResident' },
      ],
      required: true,
    },
    {
      name: 'rateMode',
      label: '税率形式',
      type: 'select',
      defaultValue: 'table',
      options: [
        { label: '超额累进表', value: 'table' },
        { label: '比例税率', value: 'flat' },
      ],
      required: true,
    },
    { name: 'flatRate', label: '比例税率', type: 'number', min: 0, max: 1, admin: { description: '比例税率使用小数，例如 20% 填 0.2。' } },
    {
      name: 'tableRows',
      label: '税率区间',
      type: 'array',
      dbName: 'rows',
      fields: [
        { name: 'rangeLabel', label: '区间文案', type: 'text', required: true },
        { name: 'lowerBound', label: '区间下限', type: 'number', min: 0, defaultValue: 0 },
        { name: 'upperBound', label: '区间上限', type: 'number', min: 0 },
        { name: 'rate', label: '税率 / 预扣率', type: 'number', required: true, min: 0, max: 1, admin: { description: '使用小数，例如 10% 填 0.1。' } },
        { name: 'quickDeduction', label: '速算扣除数', type: 'number', defaultValue: 0, min: 0 },
        { name: 'sortOrder', label: '显示顺序', type: 'number', defaultValue: 10 },
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
      admin: {
        description: '只有“有效”状态会被前台税率表和计算器读取。',
      },
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
      admin: {
        description: '建议保留国家税务总局或政策文件链接和核对日期。',
      },
      fields: [
        { name: 'title', label: '来源标题', type: 'text' },
        { name: 'url', label: '来源链接', type: 'text' },
        { name: 'checkedAt', label: '核对日期', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
        { name: 'remark', label: '备注', type: 'textarea' },
      ],
    },
    { name: 'note', label: '规则说明', type: 'textarea' },
    {
      name: 'warnings',
      label: '解析警告',
      type: 'array',
      fields: [{ name: 'message', label: '警告内容', type: 'text', required: true }],
    },
    { name: 'rawData', label: '原始数据', type: 'json', admin: { description: '用于审计和排查，不参与计算。' } },
  ],
}
