import type { Metadata } from 'next'
import BonusTaxClient from './BonusTaxClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `年终奖个税计算与单独计税｜${currentYear}年｜${siteName}`,
  description: `了解年终奖单独计税与并入综合所得的区别，判断不同计税方式对到手收入的影响。`,
  alternates: { canonical: '/bonus-tax' },
}

export default function BonusTaxPage() {
  return <BonusTaxClient />
}
