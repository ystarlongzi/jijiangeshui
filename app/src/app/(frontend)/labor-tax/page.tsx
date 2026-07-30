import type { Metadata } from 'next'
import LaborTaxClient from './LaborTaxClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `${currentYear}年劳务报酬个税计算器｜${siteName}`,
  description: `按居民个人劳务报酬预扣规则，计算 ${currentYear} 年劳务报酬预扣个税、费用扣除和税后到手金额。`,
  alternates: { canonical: '/labor-tax' },
}

export default function LaborTaxPage() {
  return <LaborTaxClient />
}
