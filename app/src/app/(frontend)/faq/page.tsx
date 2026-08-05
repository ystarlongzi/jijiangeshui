import type { Metadata } from 'next'
import ToolContentPage from '../_components/ToolContentPage'
import JsonLd from '../_components/JsonLd'
import { getPublishedFaqs } from '@/lib/faq-content-service'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `工资个税常见问题｜${currentYear}年｜${siteName}`,
  description: `集中解答工资个税、累计预扣、社保公积金基数、专项附加扣除和年度汇算等常见问题。`,
  alternates: { canonical: '/faq' },
}

export default async function FaqPage() {
  const faqs = await getPublishedFaqs()

  return <>
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      name: `工资个税常见问题｜${currentYear}年｜${siteName}`,
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    }} />
    <ToolContentPage
      eyebrow="工资个税常见问题"
      title="关于工资个税，你可能还想知道"
      description="把工资条上的税前工资、五险一金、累计预扣和到手工资之间的关系讲清楚。"
      action={{ href: '/calculator', label: '开始计算' }}
      sections={faqs.map((faq) => ({ title: faq.question, description: faq.answer }))}
      active="faq"
    />
  </>
}
