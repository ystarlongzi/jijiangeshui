import type { Metadata } from 'next'
import RentalTaxClient from '../_features/income-tax-tools/rental/RentalTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import JsonLd, { createCalculatorJsonLd } from '../_components/JsonLd'

export const metadata: Metadata = {
  title: `${currentYear}年财产租赁个税计算器｜房屋出租个税｜${siteName}`,
  description: `输入租金收入、税费、转租租金和修缮费用，测算 ${currentYear} 年财产租赁所得个人所得税和税后收入。`,
  alternates: { canonical: '/rental-tax' },
}

export default function RentalTaxPage() {
  return <>
    <JsonLd data={createCalculatorJsonLd({ name: `${currentYear}年财产租赁个税计算器`, description: metadata.description, url: `${siteUrl}/rental-tax`, siteName })} />
    <RentalTaxClient />
  </>
}
