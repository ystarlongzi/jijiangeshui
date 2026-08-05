import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react'
import { RichText } from '@payloadcms/richtext-lexical/react'

import { getArticleCanonicalUrl, getPublishedArticle, getPublishedArticles } from '@/lib/article-content-service'
import { siteName, siteUrl } from '@/lib/site'
import JsonLd from '../../_components/JsonLd'
import SiteFooter from '../../_components/SiteFooter'
import SiteHeader from '../../_components/SiteHeader'
import { formatDateOnly } from '../../_lib/date'
import styles from './ArticleDetailPage.module.css'

type ArticleDetailPageProps = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const articles = await getPublishedArticles()
  return articles.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await getPublishedArticle(slug)

  if (!article) {
    return { title: `文章未找到｜${siteName}`, robots: { index: false, follow: false } }
  }

  const canonical = getArticleCanonicalUrl(article)
  const description = article.seo.description || article.excerpt

  return {
    title: article.seo.title || `${article.title}｜${siteName}`,
    description,
    alternates: { canonical },
    robots: { index: !article.seo.noIndex, follow: !article.seo.noIndex },
    openGraph: {
      type: 'article',
      title: article.seo.title || article.title,
      description,
      url: canonical,
      publishedTime: article.createdAt,
      modifiedTime: article.updatedAt,
    },
  }
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params
  const article = await getPublishedArticle(slug)

  if (!article) {
    notFound()
  }

  const articleUrl = getArticleCanonicalUrl(article)

  return <div className="app-shell">
    <SiteHeader />
    <main className={styles.page}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.seo.description || article.excerpt,
        datePublished: article.createdAt,
        dateModified: article.updatedAt,
        mainEntityOfPage: articleUrl,
        author: { '@type': 'Organization', name: siteName, url: siteUrl },
        publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
      }} />

      <article>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/articles"><ArrowLeft size={15} />全部文章</Link>
          <div className={styles.meta}><span>{article.categoryLabel}</span><time dateTime={article.updatedAt}><CalendarDays size={14} />{formatDateOnly(article.updatedAt)} 更新</time></div>
          <h1>{article.title}</h1>
          {article.excerpt && <p>{article.excerpt}</p>}
        </header>

        <RichText className={styles.richText} data={article.content} />
      </article>

      <nav className={styles.nextStep} aria-label="文章后续操作">
        <div><span>需要根据实际工资核对？</span><strong>进入工资计算器查看到手、五险一金和全年预扣。</strong></div>
        <Link href="/calculator">开始计算 <ArrowRight size={15} /></Link>
      </nav>

      <SiteFooter />
    </main>
  </div>
}
