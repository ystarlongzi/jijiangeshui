import type { Metadata } from 'next'
import CalculatorClient from './CalculatorClient'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `工资薪金个税计算器｜${currentYear}年五险一金与全年明细｜${siteName}`,
  description: `按缴费城市、社保公积金基数和专项扣除，测算 ${currentYear} 年工资到手、个人所得税与全年逐月明细。`,
  alternates: { canonical: '/calculator' },
}

export default function CalculatorPage() {
  return <CalculatorClient />
}
