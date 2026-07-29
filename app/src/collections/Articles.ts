import type { CollectionConfig } from 'payload'

export const Articles: CollectionConfig = {
  slug: 'articles',
  labels: {
    singular: '税务文章',
    plural: '税务文章',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'slug', '_status', 'updatedAt'],
  },
  versions: { drafts: true, maxPerDoc: 30 },
  fields: [
    { name: 'title', label: '标题', type: 'text', required: true },
    { name: 'slug', label: 'URL 标识', type: 'text', required: true, unique: true },
    { name: 'excerpt', label: '摘要', type: 'textarea' },
    {
      name: 'category',
      label: '分类',
      type: 'select',
      options: [
        { label: '个税知识', value: 'tax-knowledge' },
        { label: '社保公积金', value: 'social-housing' },
        { label: '城市政策', value: 'city-policy' },
        { label: '计算案例', value: 'case' },
      ],
      required: true,
    },
    { name: 'content', label: '正文', type: 'richText' },
    {
      name: 'seo',
      label: 'SEO',
      type: 'group',
      fields: [
        { name: 'title', label: 'SEO 标题', type: 'text' },
        { name: 'description', label: 'SEO 描述', type: 'textarea' },
        { name: 'canonicalUrl', label: 'Canonical URL', type: 'text' },
        { name: 'noIndex', label: '禁止收录', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}
