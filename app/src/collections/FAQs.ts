import type { CollectionConfig } from 'payload'

export const FAQs: CollectionConfig = {
  slug: 'faqs',
  labels: {
    singular: '常见问题',
    plural: '常见问题',
  },
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'category', 'sortOrder', '_status'],
  },
  versions: { drafts: true, maxPerDoc: 20 },
  fields: [
    { name: 'question', label: '问题', type: 'text', required: true },
    { name: 'slug', label: 'URL 标识', type: 'text', required: true, unique: true },
    {
      name: 'category',
      label: '分类',
      type: 'select',
      options: [
        { label: '工资个税', value: 'salary-tax' },
        { label: '社保公积金', value: 'social-housing' },
        { label: '专项附加扣除', value: 'deductions' },
      ],
      required: true,
    },
    { name: 'answer', label: '答案', type: 'richText' },
    { name: 'sortOrder', label: '显示顺序', type: 'number', defaultValue: 10 },
  ],
}
