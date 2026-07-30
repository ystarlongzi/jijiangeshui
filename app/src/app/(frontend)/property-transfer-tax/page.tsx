import type { Metadata } from 'next'
import PropertyTransferTaxClient from './PropertyTransferTaxClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `${currentYear}年财产转让个税计算器｜转让所得个税｜${siteName}`,
  description: `输入转让收入、财产原值和合理费用，测算 ${currentYear} 年财产转让所得个人所得税和税后收入。`,
  alternates: { canonical: '/property-transfer-tax' },
}

export default function PropertyTransferTaxPage() {
  return <PropertyTransferTaxClient />
}
