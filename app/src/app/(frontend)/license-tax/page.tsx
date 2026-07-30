import type { Metadata } from 'next'
import LicenseTaxClient from './LicenseTaxClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `${currentYear}年特许权使用费个税计算器｜${siteName}`,
  description: `按居民个人特许权使用费所得预扣规则，计算 ${currentYear} 年特许权使用费费用扣除、预扣个税和税后到手金额。`,
  alternates: { canonical: '/license-tax' },
}

export default function LicenseTaxPage() {
  return <LicenseTaxClient />
}
