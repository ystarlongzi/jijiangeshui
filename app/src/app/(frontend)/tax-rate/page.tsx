import type { Metadata } from 'next'
import { ArrowRight, BookOpen, Calculator } from 'lucide-react'
import { currentYear, ruleCheckedDate, siteName, siteUrl } from '@/lib/site'
import TaxRateTabs from '../_features/tax-rate/TaxRateTabs'
import styles from './page.module.css'
import SiteHeader from '../_components/SiteHeader'
import SiteFooter from '../_components/SiteFooter'
import JsonLd from '../_components/JsonLd'
import PrimaryActionLink from '../_components/PrimaryActionLink'
import Link from 'next/link'

export const metadata: Metadata = {
  title: `税率表｜${currentYear}年个人所得税预扣规则｜${siteName}`,
  description: `${currentYear}年个人所得税税率表和预扣规则，支持工资薪金、劳务报酬、稿酬、特许权使用费和非居民个人所得。`,
  alternates: { canonical: '/tax-rate' },
}

const taxRateFaq = [
  {
    question: '工资一样，为什么每个月个税可能不同？',
    answer: '工资薪金通常采用累计预扣法。累计收入、累计扣除和已预扣税额会随着月份变化，所以本月个税不一定固定。',
  },
  {
    question: '劳务报酬、稿酬也有自己的税率表吗？',
    answer: '有。居民个人劳务报酬适用预扣率表二，稿酬和特许权使用费通常适用 20% 比例预扣率；非居民个人还要根据对应的非居民税率表计算。',
  },
  {
    question: '这张表可以用于年终奖吗？',
    answer: '年终奖可能适用单独计税或并入综合所得等不同口径，不能直接套用本表判断，建议使用年终奖专项计算器进行对比。',
  },
]

export default function TaxRatePage() {
  return <><JsonLd data={[
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${currentYear} 年个人所得税税率表`,
      url: `${siteUrl}/tax-rate`,
      description: metadata.description,
      dateModified: ruleCheckedDate,
      isPartOf: { '@type': 'WebSite', name: siteName, url: siteUrl },
      publisher: { '@type': 'Organization', name: siteName },
      mainEntity: {
        '@type': 'ItemList',
        name: `${currentYear} 年个人所得税税率表`,
        itemListElement: ['工资薪金', '劳务报酬', '稿酬', '特许权使用费', '经营所得', '财产租赁', '财产转让', '利息股息红利', '偶然所得'].map((name, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name,
          url: `${siteUrl}/tax-rate#${index + 1}`,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: siteName, item: siteUrl },
        { '@type': 'ListItem', position: 2, name: '税率表', item: `${siteUrl}/tax-rate` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: taxRateFaq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ]} /><div className="app-shell"><SiteHeader active="tax-rate" /><main className={styles.page}>
    <header className={styles.header}><div><div className={styles.titleLine}><BookOpen size={20} /><span>{currentYear} 年个人所得税规则</span></div><h1>税率表</h1><p>工资薪金、劳务报酬、稿酬及其他所得，分别适用不同的税率和计税规则。</p></div><PrimaryActionLink className={styles.headerAction} href="/calculator">用税率表算工资 <Calculator size={16} /></PrimaryActionLink></header>
    <TaxRateTabs />
    <section className={styles.explanation}><div><h2>看完税率表，下一步做什么？</h2><p>先确认自己的所得类型，再进入对应计算器。工资薪金用户可以输入城市、工资和五险一金，查看本月到手与全年预扣逐月变化；专项扣除也会影响最终结果。</p></div><div className={styles.nextActions}><Link href="/calculator">算工资到手 <ArrowRight size={15} /></Link><Link href="/calculator#deduction">看专项扣除 <ArrowRight size={15} /></Link></div></section>
    <section className={styles.faq}><h2>常见问题</h2>{taxRateFaq.map((item, index) => <details key={item.question} open={index === 0}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>
    <div className={styles.bottomActions}><Link href="/calculator"><Calculator size={16} />返回工资计算器</Link><Link href="/">返回首页 <ArrowRight size={16} /></Link></div>
    <SiteFooter />
  </main></div></>
}
