import type { Metadata } from 'next'
import CalculatorClient from './CalculatorClient'

export const metadata: Metadata = {
  title: '工资薪金个税计算器 | 极简个税',
  description: '按缴费城市、社保公积金基数和专项扣除，测算工资到手、个人所得税与全年逐月明细。',
}

export default function CalculatorPage() {
  return <CalculatorClient />
}
