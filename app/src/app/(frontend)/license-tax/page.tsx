import type { Metadata } from 'next'
import LicenseTaxClient from '../_features/income-tax-tools/license/LicenseTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import { getIncomeTaxRuleDataset } from '@/lib/income-tax-rule-service'
import { findIncomeTaxRateRule } from '@/lib/income-tax-calculator-rules'
import JsonLd, { createCalculatorJsonLd } from '../_components/JsonLd'

export const metadata: Metadata = {
  title: `${currentYear}年特许权使用费个税计算器｜${siteName}`,
  description: `按居民个人特许权使用费所得预扣规则，计算 ${currentYear} 年特许权使用费费用扣除、预扣个税和税后到手金额。`,
  alternates: { canonical: '/license-tax' },
}

export default async function LicenseTaxPage() {
  const dataset = await getIncomeTaxRuleDataset()
  const yearRules = dataset.rulesByYear[String(currentYear)]
  const taxRateRule = findIncomeTaxRateRule(yearRules, 'license', 'resident')

  return <>
    <JsonLd data={createCalculatorJsonLd({ name: `${currentYear}年特许权使用费个税计算器`, description: metadata.description, url: `${siteUrl}/license-tax`, siteName })} />
    <LicenseTaxClient taxRateRule={taxRateRule} taxRateYear={currentYear} />
  </>
}
