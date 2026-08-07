import { draftMode } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

import {
  ARTICLE_PREVIEW_COOKIE,
  getArticlePreviewSession,
} from '@/lib/article-preview'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const preview = getArticlePreviewSession(token)

  if (!preview) {
    return new NextResponse('Preview unauthorized', { status: 401 })
  }

  const mode = await draftMode()
  mode.enable()

  const response = NextResponse.redirect(new URL(`/articles/${encodeURIComponent(preview.slug)}`, request.url))
  response.cookies.set({
    name: ARTICLE_PREVIEW_COOKIE,
    value: String(preview.expiresAt),
    httpOnly: true,
    maxAge: Math.max(1, preview.expiresAt - Math.floor(Date.now() / 1000)),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
