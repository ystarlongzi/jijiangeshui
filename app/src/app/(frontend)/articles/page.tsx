import type { Metadata } from 'next'
import { ArrowRight, BookOpen, CalendarDays } from 'lucide-react'

import { getIndexableArticles } from '@/lib/article-content-service'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import JsonLd from '../_components/JsonLd'
import SiteFooter from '../_components/SiteFooter'
import SiteHeader from '../_components/SiteHeader'
import TrackedLink from '../_components/TrackedLink'
import { formatDateOnly } from '../_lib/date'
import styles from './ArticlesPage.module.css'

export const metadata: Metadata = {
  title: `${currentYear}年个税知识与实用指南｜${siteName}`,
  description: '了解工资个税、社保公积金、专项附加扣除、城市政策和常见计算案例。',
  alternates: { canonical: '/articles' },
}

export default async function ArticlesPage() {
  const articles = await getIndexableArticles()

  return <div className="app-shell">
    <SiteHeader />
    <main className={styles.page}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: metadata.title,
        description: metadata.description,
        url: `${siteUrl}/articles`,
        isPartOf: { '@type': 'WebSite', name: siteName, url: siteUrl },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: articles.map((article, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: article.title,
            url: `${siteUrl}/articles/${encodeURIComponent(article.slug)}`,
          })),
        },
      }} />

      <header className={styles.hero}>
        <div className={styles.eyebrow}><BookOpen size={20} /><span>{currentYear} 年个税知识</span></div>
        <h1>把规则讲明白，再做选择。</h1>
        <p>从工资个税、社保公积金到专项附加扣除，用可核对的规则和案例解释每个数字。</p>
      </header>

      {articles.length > 0 ? <section className={styles.grid} aria-label="税务知识文章">
        {articles.map((article) => <TrackedLink
          className={styles.card}
          eventPayload={{ module: 'articles_list', label: article.title }}
          href={`/articles/${encodeURIComponent(article.slug)}`}
          key={article.slug}
        >
          <span className={styles.category}>{article.categoryLabel}</span>
          <h2>{article.title}</h2>
          <p>{article.excerpt}</p>
          <span className={styles.cardFooter}>
            <span><CalendarDays size={14} />{formatDateOnly(article.updatedAt)}</span>
            <strong>阅读文章 <ArrowRight size={15} /></strong>
          </span>
        </TrackedLink>)}
      </section> : <section className={styles.emptyState}>
        <BookOpen size={24} />
        <div><h2>内容正在整理中</h2><p>可以先使用工资计算器，或查看工资个税常见问题。</p></div>
        <TrackedLink href="/calculator" eventPayload={{ module: 'articles_empty', label: '开始计算' }}>开始计算 <ArrowRight size={15} /></TrackedLink>
      </section>}

      <SiteFooter />
    </main>
  </div>
}
