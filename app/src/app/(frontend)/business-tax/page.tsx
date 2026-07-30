import type { Metadata } from 'next'
import BusinessTaxClient from './BusinessTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import JsonLd, { createCalculatorJsonLd } from '../JsonLd'

export const metadata: Metadata = {
  title: `${currentYear}年经营所得个税计算器｜个体工商户个税｜${siteName}`,
  description: `输入年度收入、成本费用和损失，按 ${currentYear} 年经营所得五级超额累进税率测算个人所得税。`,
  alternates: { canonical: '/business-tax' },
}

export default function BusinessTaxPage() {
  return <>
    <JsonLd data={createCalculatorJsonLd({ name: `${currentYear}年经营所得个税计算器`, description: metadata.description, url: `${siteUrl}/business-tax`, siteName })} />
    <BusinessTaxClient />
  </>
}
