import type { Metadata } from 'next'
import LaborTaxClient from '../_features/income-tax-tools/labor/LaborTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import { getIncomeTaxRuleDataset } from '@/lib/income-tax-rule-service'
import { findIncomeTaxRateRule } from '@/lib/income-tax-calculator-rules'
import JsonLd, { createCalculatorJsonLd } from '../_components/JsonLd'

export const metadata: Metadata = {
  title: `${currentYear}年劳务报酬个税计算器｜${siteName}`,
  description: `按居民个人劳务报酬预扣规则，计算 ${currentYear} 年劳务报酬预扣个税、费用扣除和税后到手金额。`,
  alternates: { canonical: '/labor-tax' },
}

export default async function LaborTaxPage() {
  const dataset = await getIncomeTaxRuleDataset()
  const yearRules = dataset.rulesByYear[String(currentYear)]
  const taxRateRule = findIncomeTaxRateRule(yearRules, 'labor', 'resident')

  return <>
    <JsonLd data={createCalculatorJsonLd({ name: `${currentYear}年劳务报酬个税计算器`, description: metadata.description, url: `${siteUrl}/labor-tax`, siteName })} />
    <LaborTaxClient taxRateRule={taxRateRule} taxRateYear={currentYear} />
  </>
}
