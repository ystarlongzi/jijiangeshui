import type { CollectionConfig } from 'payload'

export const Cities: CollectionConfig = {
  slug: 'cities',
  defaultSort: ['provinceName', 'name'],
  labels: {
    singular: '城市',
    plural: '城市',
  },
  admin: {
    useAsTitle: 'name',
    group: '基础数据',
    defaultColumns: ['name', 'provinceName', 'slug', 'enabled'],
    listSearchableFields: ['name', 'shortName', 'provinceName', 'slug', 'areaId', 'areaCode'],
    description: '管理城市基础信息和城市 SEO 页面入口。',
  },
  fields: [
    {
      name: 'name',
      label: '城市名称',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'URL 标识',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: '例如 beijing，对应 /city/beijing/。',
      },
    },
    {
      name: 'provinceName',
      label: '省份',
      type: 'text',
      required: true,
      admin: {
        description: '用于城市列表分组和城市 SEO 页面展示。',
      },
    },
    {
      name: 'level',
      label: '行政层级',
      type: 'select',
      defaultValue: 'city',
      options: [
        { label: '省/直辖市', value: 'province' },
        { label: '城市', value: 'city' },
        { label: '区县', value: 'district' },
      ],
      required: true,
    },
    {
      name: 'areaId',
      label: '第三方 areaId',
      type: 'text',
      admin: {
        description: '来源平台的城市 ID，用于规则采集和导入匹配。',
      },
    },
    {
      name: 'parentAreaId',
      label: '上级 areaId',
      type: 'text',
    },
    {
      name: 'areaCode',
      label: '第三方 areaCode',
      type: 'text',
      admin: {
        description: '来源平台的城市编码，作为导入匹配的补充字段。',
      },
    },
    {
      name: 'shortName',
      label: '简称',
      type: 'text',
    },
    {
      name: 'enabled',
      label: '启用',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'seo',
      label: 'SEO',
      type: 'group',
      fields: [
        { name: 'title', label: 'SEO 标题', type: 'text' },
        { name: 'description', label: 'SEO 描述', type: 'textarea' },
        { name: 'noIndex', label: '禁止收录', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}
