import type { Metadata } from 'next'
import BonusTaxClient from '../_features/bonus-tax/BonusTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import JsonLd from '../_components/JsonLd'

export const metadata: Metadata = {
  title: `年终奖个税计算与单独计税｜${currentYear}年｜${siteName}`,
  description: `了解年终奖单独计税与并入综合所得的区别，判断不同计税方式对到手收入的影响。`,
  alternates: { canonical: '/bonus-tax' },
}

export default function BonusTaxPage() {
  return <>
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: `年终奖个税计算器 ${currentYear}`,
      url: `${siteUrl}/bonus-tax`,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description: metadata.description,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'CNY' },
      publisher: { '@type': 'Organization', name: siteName },
    }} />
    <BonusTaxClient />
  </>
}
