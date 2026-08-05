import type { Metadata } from 'next'
import { currentYear, siteName } from '@/lib/site'
import SpecialDeductionsClient from '../_features/special-deductions/SpecialDeductionsClient'
import { getIncomeTaxRuleDataset } from '@/lib/income-tax-rule-service'

export const metadata: Metadata = {
  title: `专项附加扣除计算器｜${currentYear}年子女教育、住房租金、赡养老人扣除标准｜${siteName}`,
  description: `专项附加扣除计算器，支持直接输入总额，也可按子女教育、婴幼儿照护、继续教育、住房租金、住房贷款利息、赡养老人等项目计算月扣除额。`,
  alternates: { canonical: '/special-deductions' },
}

export default async function SpecialDeductionsPage() {
  const dataset = await getIncomeTaxRuleDataset()
  const deductionRules = dataset.rulesByYear[String(currentYear)]
  return <SpecialDeductionsClient deductionRules={deductionRules} />
}
