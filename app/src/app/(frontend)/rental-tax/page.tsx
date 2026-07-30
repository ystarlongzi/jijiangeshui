import type { Metadata } from 'next'
import RentalTaxClient from './RentalTaxClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `${currentYear}年财产租赁个税计算器｜房屋出租个税｜${siteName}`,
  description: `输入租金收入、税费、转租租金和修缮费用，测算 ${currentYear} 年财产租赁所得个人所得税和税后收入。`,
  alternates: { canonical: '/rental-tax' },
}

export default function RentalTaxPage() {
  return <RentalTaxClient />
}
