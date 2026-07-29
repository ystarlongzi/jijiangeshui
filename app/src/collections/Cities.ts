import type { CollectionConfig } from 'payload'

export const Cities: CollectionConfig = {
  slug: 'cities',
  labels: {
    singular: '城市',
    plural: '城市',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'provinceName', 'slug', 'enabled'],
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
