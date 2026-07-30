import type { Metadata } from 'next'
import BusinessTaxClient from './BusinessTaxClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `${currentYear}年经营所得个税计算器｜个体工商户个税｜${siteName}`,
  description: `输入年度收入、成本费用和损失，按 ${currentYear} 年经营所得五级超额累进税率测算个人所得税。`,
  alternates: { canonical: '/business-tax' },
}

export default function BusinessTaxPage() {
  return <BusinessTaxClient />
}
