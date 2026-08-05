import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig } from 'payload'

import { revalidateArticleContent } from '../lib/article-cache'
import { getArticlePreviewUrl } from '../lib/article-preview'

const revalidateAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc }) => {
  await revalidateArticleContent({ slug: doc.slug, previousSlug: previousDoc?.slug })
  return doc
}

const revalidateAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  await revalidateArticleContent({ slug: doc.slug })
  return doc
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  defaultSort: '-updatedAt',
  labels: {
    singular: '税务文章',
    plural: '税务文章',
  },
  admin: {
    useAsTitle: 'title',
    group: '内容运营',
    defaultColumns: ['title', 'category', 'slug', '_status', 'updatedAt'],
    listSearchableFields: ['title', 'excerpt', 'slug', 'seo.title', 'seo.description'],
    description: '维护税务知识、城市政策、计算案例等可收录内容。',
    preview: (doc) => getArticlePreviewUrl(doc.slug),
  },
  hooks: {
    afterChange: [revalidateAfterChange],
    afterDelete: [revalidateAfterDelete],
  },
  versions: { drafts: true, maxPerDoc: 30 },
  fields: [
    { name: 'title', label: '标题', type: 'text', required: true },
    { name: 'slug', label: 'URL 标识', type: 'text', required: true, unique: true, admin: { description: '文章 URL 使用，例如 /articles/xxx。' } },
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
      admin: {
        description: '用于搜索结果标题、描述和 canonical 控制。',
      },
      fields: [
        { name: 'title', label: 'SEO 标题', type: 'text' },
        { name: 'description', label: 'SEO 描述', type: 'textarea' },
        { name: 'canonicalUrl', label: 'Canonical URL', type: 'text' },
        { name: 'noIndex', label: '禁止收录', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}
