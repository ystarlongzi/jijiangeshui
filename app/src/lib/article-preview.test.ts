import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getArticlePreviewSession,
  getArticlePreviewUrl,
  isArticlePreviewSessionValid,
} from './article-preview'

test('creates a signed preview URL without exposing the preview secret', () => {
  const previousSecret = process.env.PAYLOAD_PREVIEW_SECRET
  const previousUrl = process.env.NEXT_PUBLIC_SERVER_URL
  process.env.PAYLOAD_PREVIEW_SECRET = 'test-preview-secret'
  process.env.NEXT_PUBLIC_SERVER_URL = 'http://localhost:4000'

  try {
    const previewUrl = new URL(getArticlePreviewUrl('tax-basics') ?? '')
    const token = previewUrl.searchParams.get('token')
    assert.equal(previewUrl.pathname, '/api/preview')
    assert.equal(previewUrl.searchParams.has('secret'), false)
    assert.ok(token)
    assert.deepEqual(getArticlePreviewSession(token), {
      slug: 'tax-basics',
      expiresAt: getArticlePreviewSession(token)?.expiresAt,
    })
  } finally {
    restoreEnvironment('PAYLOAD_PREVIEW_SECRET', previousSecret)
    restoreEnvironment('NEXT_PUBLIC_SERVER_URL', previousUrl)
  }
})

test('rejects tampered preview tokens and expired sessions', () => {
  const previousSecret = process.env.PAYLOAD_PREVIEW_SECRET
  process.env.PAYLOAD_PREVIEW_SECRET = 'test-preview-secret'

  try {
    const previewUrl = new URL(getArticlePreviewUrl('tax-basics') ?? '')
    const token = previewUrl.searchParams.get('token') ?? ''
    assert.equal(getArticlePreviewSession(`${token}x`), null)
    const session = getArticlePreviewSession(token)
    assert.ok(session)
    assert.equal(getArticlePreviewSession(token, session.expiresAt), null)
    assert.equal(isArticlePreviewSessionValid(String(session.expiresAt), session.expiresAt), false)
  } finally {
    restoreEnvironment('PAYLOAD_PREVIEW_SECRET', previousSecret)
  }
})

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}
