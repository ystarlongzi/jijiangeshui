import type { Metadata } from 'next'
import PropertyTransferTaxClient from '../_features/income-tax-tools/property-transfer/PropertyTransferTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import { getIncomeTaxRuleDataset } from '@/lib/income-tax-rule-service'
import { findIncomeTaxRateRule } from '@/lib/income-tax-calculator-rules'
import JsonLd, { createCalculatorJsonLd } from '../_components/JsonLd'

export const metadata: Metadata = {
  title: `${currentYear}年财产转让个税计算器｜转让所得个税｜${siteName}`,
  description: `输入转让收入、财产原值和合理费用，测算 ${currentYear} 年财产转让所得个人所得税和税后收入。`,
  alternates: { canonical: '/property-transfer-tax' },
}

export default async function PropertyTransferTaxPage() {
  const dataset = await getIncomeTaxRuleDataset()
  const yearRules = dataset.rulesByYear[String(currentYear)]
  const taxRateRule = findIncomeTaxRateRule(yearRules, 'transfer', 'notApplicable')

  return <>
    <JsonLd data={createCalculatorJsonLd({ name: `${currentYear}年财产转让个税计算器`, description: metadata.description, url: `${siteUrl}/property-transfer-tax`, siteName })} />
    <PropertyTransferTaxClient taxRateRule={taxRateRule} taxRateYear={currentYear} />
  </>
}
