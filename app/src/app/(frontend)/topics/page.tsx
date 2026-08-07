import type { Metadata } from 'next'
import { ArrowRight, BookOpen, CalendarRange, MapPin, ReceiptText, TrendingUp } from 'lucide-react'
import SiteFooter from '../_components/SiteFooter'
import SiteHeader from '../_components/SiteHeader'
import JsonLd from '../_components/JsonLd'
import TrackedLink from '../_components/TrackedLink'
import { getIndexableArticles } from '@/lib/article-content-service'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import { formatDateOnly } from '../_lib/date'
import styles from './TopicsPage.module.css'

export const metadata: Metadata = {
  title: `${currentYear}年个税专题｜年中入职、年底个税、城市工资到手｜${siteName}`,
  description: `整理年中入职、年底个税变高、工资档位、城市工资到手和不同所得类型案例，快速进入对应计算器。`,
  alternates: { canonical: '/topics' },
}

const topics = [
  {
    title: '年中入职个税怎么算？',
    description: '入职月份会影响累计收入和累计扣除。用工资薪金计算器选择入职月份，可以查看入职后每个月的预扣变化。',
    href: '/calculator',
    action: '选择入职月份',
    icon: CalendarRange,
  },
  {
    title: '为什么年底个税会变高？',
    description: '累计预扣法会随着全年收入累加调整税率档位。逐月明细能看出从哪一个月开始跨档。',
    href: '/faq',
    action: '查看原因',
    icon: TrendingUp,
  },
  {
    title: '月薪不同档位到手差多少？',
    description: '同样是税前工资，社保公积金基数、专项附加扣除和预扣率都会影响实际到手。',
    href: '/calculator',
    action: '输入工资试算',
    icon: ReceiptText,
  },
  {
    title: '城市社保公积金影响到手工资',
    description: '北京、上海、深圳、广州、杭州等城市的社保和公积金基数范围不同，城市页会展示对应规则。',
    href: '/city',
    action: '按城市查看',
    icon: MapPin,
  },
  {
    title: '劳务、稿酬和特许权怎么选？',
    description: '不同所得类型适用不同预扣规则。先判断收入性质，再进入对应计算器估算税后收入。',
    href: '/labor-tax',
    action: '看劳务报酬',
    icon: BookOpen,
  },
]

const incomeLinks = [
  { label: '劳务报酬', href: '/labor-tax' },
  { label: '稿酬', href: '/author-tax' },
  { label: '特许权使用费', href: '/license-tax' },
  { label: '经营所得', href: '/business-tax' },
  { label: '财产租赁', href: '/rental-tax' },
  { label: '财产转让', href: '/property-transfer-tax' },
  { label: '利息股息红利', href: '/dividend-tax' },
  { label: '偶然所得', href: '/accidental-tax' },
]

export default async function TopicsPage() {
  const articles = await getIndexableArticles(6)
  const structuredItems = [
    ...topics.map((topic) => ({ name: topic.title, url: `${siteUrl}${topic.href}` })),
    ...articles.map((article) => ({ name: article.title, url: `${siteUrl}/articles/${encodeURIComponent(article.slug)}` })),
  ]

  return <div className="app-shell">
    <SiteHeader />
    <main className={styles.page}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${currentYear} 年个税专题`,
        url: `${siteUrl}/topics`,
        description: metadata.description,
        isPartOf: { '@type': 'WebSite', name: siteName, url: siteUrl },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: structuredItems.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            url: item.url,
          })),
        },
      }} />
      <section className={styles.hero}>
        <div>
          <div className={styles.titleLine}><BookOpen size={20} /><span>{currentYear} 年个税专题</span></div>
          <h1>按场景找到该用的计算器</h1>
          <p>把常见搜索问题整理成入口：年中入职、年底个税、工资档位、城市工资到手和不同所得类型。</p>
        </div>
      </section>

      <section className={styles.grid} aria-label="个税专题入口">
        {topics.map(({ title, description, href, action, icon: Icon }) => <TrackedLink className={styles.card} href={href} eventPayload={{ module: 'topics_grid', label: title }} key={title}>
          <Icon size={22} strokeWidth={1.8} />
          <span>{title}</span>
          <p>{description}</p>
          <strong>{action} <ArrowRight size={15} /></strong>
        </TrackedLink>)}
      </section>

      <section className={styles.incomeSection}>
        <div>
          <h2>不同所得类型入口</h2>
          <p>如果不是工资薪金收入，可以从这里进入对应的长尾计算器。</p>
        </div>
        <div className={styles.incomeLinks}>
          {incomeLinks.map((item) => <TrackedLink href={item.href} eventPayload={{ module: 'topics_income', label: item.label }} key={item.href}>{item.label}<ArrowRight size={14} /></TrackedLink>)}
        </div>
      </section>

      {articles.length > 0 && <section className={styles.articleSection}>
        <div className={styles.articleHeading}>
          <div>
            <h2>最新个税文章</h2>
            <p>从规则解读和案例入手，再回到计算器验证。</p>
          </div>
          <TrackedLink href="/articles" eventPayload={{ module: 'topics_articles', label: '查看全部' }}>查看全部 <ArrowRight size={14} /></TrackedLink>
        </div>
        <div className={styles.articleList}>
          {articles.map((article) => <TrackedLink
            href={`/articles/${encodeURIComponent(article.slug)}`}
            eventPayload={{ module: 'topics_articles', label: article.title }}
            key={article.slug}
          >
            <span>{article.categoryLabel}</span>
            <strong>{article.title}</strong>
            <time dateTime={article.updatedAt}>{formatDateOnly(article.updatedAt)}</time>
            <ArrowRight size={15} />
          </TrackedLink>)}
        </div>
      </section>}

      <SiteFooter />
    </main>
  </div>
}
