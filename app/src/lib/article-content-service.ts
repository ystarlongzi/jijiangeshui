import 'server-only'

import { unstable_cache } from 'next/cache'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { Article } from '@/payload-types'
import { siteUrl } from '@/lib/site'

export const ARTICLE_CATEGORY_LABELS = {
  'tax-knowledge': '个税知识',
  'social-housing': '社保公积金',
  'city-policy': '城市政策',
  case: '计算案例',
} satisfies Record<Article['category'], string>

export type PublicArticle = {
  title: string
  slug: string
  excerpt: string
  category: Article['category']
  categoryLabel: string
  content: NonNullable<Article['content']>
  seo: {
    title?: string
    description?: string
    canonicalUrl?: string
    noIndex: boolean
  }
  createdAt: string
  updatedAt: string
}

const readCachedArticles = unstable_cache(
  async (): Promise<PublicArticle[]> => {
    const payload = await getPayload({ config })
    const docs = await findAllPublishedArticles(payload)

    return docs
      .map(toPublicArticle)
      .filter((article): article is PublicArticle => article !== null)
  },
  ['payload-public-articles'],
  { revalidate: 300, tags: ['content-articles'] },
)

export async function getPublishedArticles(limit?: number): Promise<PublicArticle[]> {
  if (!process.env.DATABASE_URI) {
    return []
  }

  try {
    const articles = await readCachedArticles()
    return typeof limit === 'number' ? articles.slice(0, limit) : articles
  } catch {
    return []
  }
}

export async function getPublishedArticle(slug: string): Promise<PublicArticle | null> {
  const articles = await getPublishedArticles()
  return articles.find((article) => article.slug === slug) ?? null
}

export async function getPreviewArticle(slug: string): Promise<PublicArticle | null> {
  if (!process.env.DATABASE_URI) {
    return null
  }

  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'articles',
      depth: 0,
      draft: true,
      limit: 1,
      where: { slug: { equals: slug } },
    })

    return result.docs[0] ? toPublicArticle(result.docs[0]) : null
  } catch {
    return null
  }
}

export async function getIndexableArticles(limit?: number): Promise<PublicArticle[]> {
  const articles = await getPublishedArticles()
  const indexableArticles = articles.filter(isIndexableArticle)
  return typeof limit === 'number' ? indexableArticles.slice(0, limit) : indexableArticles
}

export function getArticleCanonicalUrl(article: PublicArticle): string {
  const fallbackUrl = `${siteUrl}/articles/${encodeURIComponent(article.slug)}`
  const canonicalUrl = article.seo.canonicalUrl

  if (!canonicalUrl) {
    return fallbackUrl
  }

  try {
    const parsedUrl = new URL(canonicalUrl, `${siteUrl}/`)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? parsedUrl.toString()
      : fallbackUrl
  } catch {
    return fallbackUrl
  }
}

function toPublicArticle(doc: Article): PublicArticle | null {
  if (
    typeof doc.title !== 'string'
    || typeof doc.slug !== 'string'
    || typeof doc.createdAt !== 'string'
    || typeof doc.updatedAt !== 'string'
    || !doc.content
  ) {
    return null
  }

  const title = doc.title.trim()
  const slug = doc.slug.trim()

  if (!title || !slug || !Object.hasOwn(ARTICLE_CATEGORY_LABELS, doc.category)) {
    return null
  }

  const plainText = toPlainText(doc.content)
  const seoTitle = toTrimmedString(doc.seo?.title)
  const seoDescription = toTrimmedString(doc.seo?.description)
  const excerpt = toTrimmedString(doc.excerpt) || seoDescription || plainText.slice(0, 120)

  return {
    title,
    slug,
    excerpt,
    category: doc.category,
    categoryLabel: ARTICLE_CATEGORY_LABELS[doc.category],
    content: doc.content,
    seo: {
      title: seoTitle,
      description: seoDescription,
      canonicalUrl: toTrimmedString(doc.seo?.canonicalUrl),
      noIndex: doc.seo?.noIndex === true,
    },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

async function findAllPublishedArticles(payload: Awaited<ReturnType<typeof getPayload>>): Promise<Article[]> {
  let page = 1
  let articles: Article[] = []

  while (true) {
    const result = await payload.find({
      collection: 'articles',
      depth: 0,
      draft: false,
      limit: 100,
      page,
      sort: '-updatedAt',
      where: { _status: { equals: 'published' } },
    })

    articles = [...articles, ...result.docs]
    if (!result.hasNextPage) return articles
    page += 1
  }
}

function isIndexableArticle(article: PublicArticle): boolean {
  if (article.seo.noIndex) {
    return false
  }

  const canonicalUrl = article.seo.canonicalUrl
  const isRelativeCanonical = canonicalUrl?.startsWith('/') && !canonicalUrl.startsWith('//')
  return !canonicalUrl || isRelativeCanonical || canonicalUrl.startsWith(`${siteUrl}/`)
}

function toPlainText(value: NonNullable<Article['content']>): string {
  try {
    return convertLexicalToPlaintext({ data: value }).trim()
  } catch {
    return ''
  }
}
