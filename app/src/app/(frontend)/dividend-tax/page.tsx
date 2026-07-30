import type { Metadata } from 'next'
import DividendTaxClient from './DividendTaxClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `${currentYear}年利息股息红利个税计算器｜${siteName}`,
  description: `输入利息、股息、红利收入，按 ${currentYear} 年个人所得税 20% 比例税率测算应缴个税和税后收入。`,
  alternates: { canonical: '/dividend-tax' },
}

export default function DividendTaxPage() {
  return <DividendTaxClient />
}
