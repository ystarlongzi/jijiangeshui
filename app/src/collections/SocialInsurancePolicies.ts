import type { CollectionConfig } from 'payload'

const calculationMethodOptions = [
  { label: '无缴费', value: 'none' },
  { label: '按比例', value: 'rate' },
  { label: '固定金额', value: 'fixed' },
  { label: '比例加固定金额', value: 'ratePlusFixed' },
]

export const SocialInsurancePolicies: CollectionConfig = {
  slug: 'social-insurance-policies',
  dbName: 'sip',
  defaultSort: '-updatedAt',
  labels: {
    singular: '社保公积金政策',
    plural: '社保公积金政策',
  },
  admin: {
    useAsTitle: 'policyTitle',
    group: '规则数据',
    defaultColumns: ['policyTitle', 'city', 'policyYear', 'effectiveFrom', 'policyStatus', 'updatedAt'],
    listSearchableFields: ['policyTitle', 'source.title', 'source.url', 'externalCodes.social', 'externalCodes.housingFund'],
    description: '政策规则先保存为草稿，人工核对后再标记为有效。',
  },
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.policyStatus !== 'active') return data

        if (data.warnings?.length) {
          throw new Error('存在解析警告，先处理警告后才能发布为有效规则。')
        }

        const baseRules = data.baseRules || []
        const baseTypes = baseRules.map((rule: { baseType?: string }) => rule.baseType)
        if (new Set(baseTypes).size !== baseTypes.length) {
          throw new Error('同一政策下，社保或公积金基数规则不能重复。')
        }
        if (baseRules.some((rule: { baseMin?: number; baseMax?: number }) => (rule.baseMin ?? 0) > (rule.baseMax ?? 0))) {
          throw new Error('缴费基数最低值不能大于最高值。')
        }

        const itemCodes = (data.itemRules || []).map((rule: { itemCode?: string }) => rule.itemCode)
        if (new Set(itemCodes).size !== itemCodes.length) {
          throw new Error('同一政策下，缴费项目编码不能重复。')
        }

        return data
      },
    ],
  },
  fields: [
    {
      type: 'collapsible',
      label: '基础信息',
      admin: { initCollapsed: false },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'policyTitle',
              label: '政策名称',
              type: 'text',
              required: true,
              admin: {
                width: '33.33%',
                description: '例如：北京市 2026 年社保公积金缴费规则。',
              },
            },
            {
              name: 'city',
              label: '所属城市',
              type: 'relationship',
              relationTo: 'cities',
              required: true,
              admin: {
                width: '33.33%',
                description: '选择这条社保公积金规则适用的城市。',
              },
            },
            {
              name: 'policyYear',
              label: '政策年度',
              type: 'number',
              required: true,
              min: 2000,
              max: 2100,
              admin: {
                width: '33.34%',
                description: '用于前台按年份读取规则，例如 2026。',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'effectiveFrom',
              label: '生效日期',
              type: 'date',
              required: true,
              admin: { width: '33.33%', date: { pickerAppearance: 'dayOnly' } },
            },
            {
              name: 'effectiveTo',
              label: '失效日期',
              type: 'date',
              admin: { width: '33.33%', date: { pickerAppearance: 'dayOnly' } },
            },
            {
              name: 'policyStatus',
              label: '业务状态',
              type: 'select',
              defaultValue: 'pendingReview',
              admin: {
                width: '33.34%',
                description: '只有“有效”状态会作为前台城市规则使用。',
              },
              options: [
                { label: '待审核', value: 'pendingReview' },
                { label: '有效', value: 'active' },
                { label: '已归档', value: 'archived' },
              ],
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: 'source',
      label: '规则来源',
      type: 'group',
      admin: {
        description: '记录爬虫来源、官方核对链接和人工备注，便于后续追溯。',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'title', label: '来源标题', type: 'text', admin: { width: '33.33%' } },
            { name: 'url', label: '来源链接', type: 'text', admin: { width: '33.33%' } },
            {
              name: 'checkedAt',
              label: '核对日期',
              type: 'date',
              admin: { width: '33.34%', date: { pickerAppearance: 'dayOnly' } },
            },
          ],
        },
        { name: 'remark', label: '备注', type: 'textarea' },
      ],
    },
    {
      name: 'baseRules',
      label: '缴费基数范围',
      type: 'array',
      dbName: 'bases',
      minRows: 1,
      labels: {
        singular: '缴费基数规则',
        plural: '缴费基数规则',
      },
      admin: {
        description: '社保和公积金可分别设置上下限，前台输入超出范围时按上下限估算。',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'baseType',
              label: '基数类型',
              type: 'select',
              options: [
                { label: '社保', value: 'social' },
                { label: '公积金', value: 'housingFund' },
              ],
              required: true,
              admin: { width: '33.33%' },
            },
            { name: 'baseMin', label: '最低基数', type: 'number', required: true, min: 0, admin: { width: '33.33%' } },
            { name: 'baseMax', label: '最高基数', type: 'number', required: true, min: 0, admin: { width: '33.34%' } },
          ],
        },
      ],
    },
    {
      name: 'itemRules',
      label: '缴费项目规则',
      type: 'array',
      dbName: 'items',
      labels: {
        singular: '缴费项目规则',
        plural: '缴费项目规则',
      },
      admin: {
        description: '维护养老、医疗、失业、工伤、生育、公积金等项目的个人和企业缴费方式。',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'systemType',
              label: '系统类型',
              type: 'select',
              options: [
                { label: '社保', value: 'social' },
                { label: '公积金', value: 'housingFund' },
              ],
              required: true,
              admin: { width: '33.33%' },
            },
            { name: 'itemCode', label: '项目编码', type: 'text', required: true, admin: { width: '33.33%' } },
            { name: 'itemName', label: '项目名称', type: 'text', required: true, admin: { width: '33.34%' } },
          ],
        },
        {
          name: 'employee',
          label: '个人缴纳',
          type: 'group',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'calcMethod',
                  label: '计算方式',
                  type: 'select',
                  options: calculationMethodOptions,
                  required: true,
                  admin: { width: '33.33%' },
                },
                {
                  name: 'rate',
                  label: '比例',
                  type: 'number',
                  min: 0,
                  max: 1,
                  admin: { width: '33.33%', description: '使用小数，例如 8% 填 0.08。' },
                },
                { name: 'fixedAmount', label: '固定金额', type: 'number', min: 0, admin: { width: '33.34%' } },
              ],
            },
          ],
        },
        {
          name: 'employer',
          label: '企业缴纳',
          type: 'group',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'calcMethod',
                  label: '计算方式',
                  type: 'select',
                  options: calculationMethodOptions,
                  required: true,
                  admin: { width: '33.33%' },
                },
                {
                  name: 'rate',
                  label: '比例',
                  type: 'number',
                  min: 0,
                  max: 1,
                  admin: { width: '33.33%', description: '使用小数，例如 16% 填 0.16。' },
                },
                { name: 'fixedAmount', label: '固定金额', type: 'number', min: 0, admin: { width: '33.34%' } },
              ],
            },
          ],
        },
        { name: 'sortOrder', label: '显示顺序', type: 'number', defaultValue: 10 },
      ],
    },
    {
      name: 'externalCodes',
      label: '第三方方案编码',
      type: 'group',
      admin: {
        description: '保留采集平台的方案编码，方便增量更新或排查匹配问题。',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'social', label: '社保方案编码', type: 'text', admin: { width: '50%' } },
            { name: 'housingFund', label: '公积金方案编码', type: 'text', admin: { width: '50%' } },
          ],
        },
      ],
    },
    {
      name: 'warnings',
      label: '解析警告',
      type: 'array',
      admin: { description: '存在警告时不得直接发布为有效规则。' },
      fields: [{ name: 'message', label: '警告内容', type: 'text', required: true }],
    },
    {
      name: 'rawData',
      label: '原始数据',
      type: 'json',
      admin: { description: '用于审计和排查，不参与计算。' },
    },
  ],
}
