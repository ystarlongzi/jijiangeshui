import type { Metadata } from 'next'
import AuthorTaxClient from './AuthorTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import JsonLd, { createCalculatorJsonLd } from '../_components/JsonLd'

export const metadata: Metadata = {
  title: `${currentYear}年稿酬个税计算器｜${siteName}`,
  description: `按居民个人稿酬所得预扣规则，计算 ${currentYear} 年稿酬收入费用扣除、减按 70%、预扣个税和税后到手金额。`,
  alternates: { canonical: '/author-tax' },
}

export default function AuthorTaxPage() {
  return <>
    <JsonLd data={createCalculatorJsonLd({ name: `${currentYear}年稿酬个税计算器`, description: metadata.description, url: `${siteUrl}/author-tax`, siteName })} />
    <AuthorTaxClient />
  </>
}
