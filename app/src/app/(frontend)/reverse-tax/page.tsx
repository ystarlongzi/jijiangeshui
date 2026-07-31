import type { Metadata } from 'next'
import ReverseTaxClient from '../_features/reverse-tax/ReverseTaxClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `税后反推税前工资｜${currentYear}年个税计算｜${siteName}`,
  description: `输入期望到手工资，结合城市社保公积金和专项扣除，反推所需税前月薪。`,
  alternates: { canonical: '/reverse-tax' },
}

export default function ReverseTaxPage() {
  return <ReverseTaxClient />
}
