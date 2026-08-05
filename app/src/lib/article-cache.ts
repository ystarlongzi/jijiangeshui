export const ARTICLE_CACHE_TAG = 'content-articles'

type ArticleCacheInvalidation = {
  slug?: unknown
  previousSlug?: unknown
}

export async function revalidateArticleContent({ slug, previousSlug }: ArticleCacheInvalidation = {}): Promise<void> {
  try {
    const { revalidatePath, revalidateTag } = await import('next/cache')

    revalidateTag(ARTICLE_CACHE_TAG, 'max')
    revalidatePath('/articles')
    revalidatePath('/topics')
    revalidatePath('/sitemap.xml')
    revalidatePath('/articles/[slug]', 'page')

    for (const value of [slug, previousSlug]) {
      if (typeof value === 'string' && value.trim()) {
        revalidatePath(`/articles/${encodeURIComponent(value.trim())}`)
      }
    }

  } catch (error) {
    console.error('[article-cache] Failed to invalidate article cache', error)
    throw new Error('文章缓存刷新失败，发布操作未完成。', { cause: error })
  }
}
