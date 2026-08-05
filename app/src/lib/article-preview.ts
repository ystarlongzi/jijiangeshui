import { createHmac, timingSafeEqual } from 'node:crypto'

const PREVIEW_TTL_SECONDS = 5 * 60
export const ARTICLE_PREVIEW_COOKIE = 'jijian_article_preview_expires'

type ArticlePreviewPayload = {
  slug: string
  expiresAt: number
}

export type ArticlePreviewSession = ArticlePreviewPayload

function getPreviewSecret(): string | null {
  const secret = process.env.PAYLOAD_PREVIEW_SECRET
  return typeof secret === 'string' && secret.trim() ? secret : null
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function encodePayload(payload: ArticlePreviewPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function createPreviewToken(slug: string, expiresAt: number, secret: string): string {
  const payload = encodePayload({ slug, expiresAt })
  return `${payload}.${signPayload(payload, secret)}`
}

export function getArticlePreviewUrl(slug: unknown): string | null {
  if (typeof slug !== 'string' || !slug.trim()) return null

  const secret = getPreviewSecret()
  if (!secret) return null

  const expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS
  const token = createPreviewToken(slug.trim(), expiresAt, secret)
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'
  const url = new URL('/api/preview', baseUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

export function getArticlePreviewSession(
  value: unknown,
  now = Math.floor(Date.now() / 1000),
): ArticlePreviewSession | null {
  const secret = getPreviewSecret()
  if (typeof value !== 'string' || !value || !secret) return null

  const [payload, signature, extra] = value.split('.')
  if (!payload || !signature || extra) return null

  const expected = Buffer.from(signPayload(payload, secret), 'base64url')
  const received = Buffer.from(signature, 'base64url')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  const parsed = parsePayload(payload)
  if (!parsed || parsed.expiresAt <= now) return null
  return parsed
}

export function isArticlePreviewSessionValid(value: unknown, now = Math.floor(Date.now() / 1000)): boolean {
  const expiresAt = typeof value === 'string' ? Number(value) : NaN
  return Number.isInteger(expiresAt) && expiresAt > now
}

function parsePayload(value: string): ArticlePreviewPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') return null

    const record = parsed as Record<string, unknown>
    if (
      typeof record.slug !== 'string'
      || !record.slug.trim()
      || typeof record.expiresAt !== 'number'
      || !Number.isInteger(record.expiresAt)
    ) {
      return null
    }

    return { slug: record.slug.trim(), expiresAt: record.expiresAt }
  } catch {
    return null
  }
}
