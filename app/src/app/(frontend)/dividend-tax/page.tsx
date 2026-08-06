import type { Metadata } from 'next'
import DividendTaxClient from '../_features/income-tax-tools/dividend/DividendTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import { getIncomeTaxRuleDataset } from '@/lib/income-tax-rule-service'
import { findIncomeTaxRateRule } from '@/lib/income-tax-calculator-rules'
import JsonLd, { createCalculatorJsonLd } from '../_components/JsonLd'

export const metadata: Metadata = {
  title: `${currentYear}年利息股息红利个税计算器｜${siteName}`,
  description: `输入利息、股息、红利收入，按 ${currentYear} 年个人所得税 20% 比例税率测算应缴个税和税后收入。`,
  alternates: { canonical: '/dividend-tax' },
}

export default async function DividendTaxPage() {
  const dataset = await getIncomeTaxRuleDataset()
  const yearRules = dataset.rulesByYear[String(currentYear)]
  const taxRateRule = findIncomeTaxRateRule(yearRules, 'dividend', 'notApplicable')

  return <>
    <JsonLd data={createCalculatorJsonLd({ name: `${currentYear}年利息股息红利个税计算器`, description: metadata.description, url: `${siteUrl}/dividend-tax`, siteName })} />
    <DividendTaxClient taxRateRule={taxRateRule} taxRateYear={currentYear} />
  </>
}
