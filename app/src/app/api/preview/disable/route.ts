import { draftMode } from 'next/headers'
import { NextResponse } from 'next/server'
import { ARTICLE_PREVIEW_COOKIE } from '@/lib/article-preview'

export async function GET(request: Request) {
  const mode = await draftMode()
  mode.disable()

  const response = NextResponse.redirect(new URL('/articles', request.url))
  response.cookies.delete(ARTICLE_PREVIEW_COOKIE)
  return response
}
