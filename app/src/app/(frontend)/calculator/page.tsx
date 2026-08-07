import type { Metadata } from 'next'
import CalculatorClient from '../_features/salary/CalculatorClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import JsonLd from '../_components/JsonLd'
import { getAvailableCities, getAvailableCityRuleResult } from '@/lib/city-rule-service'
import { getIncomeTaxRuleDataset } from '@/lib/income-tax-rule-service'

export const metadata: Metadata = {
  title: `工资薪金个税计算器｜${currentYear}年五险一金与全年预扣明细｜${siteName}`,
  description: `按缴费城市、社保公积金基数和专项扣除，测算 ${currentYear} 年工资到手、个人所得税与全年预扣逐月明细。`,
  alternates: { canonical: '/calculator' },
}

export default async function CalculatorPage() {
  const [cities, initialCityRule, incomeTaxRules] = await Promise.all([
    getAvailableCities({ limit: 20 }),
    getAvailableCityRuleResult('beijing'),
    getIncomeTaxRuleDataset(),
  ])

  return <>
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: `工资薪金个税计算器 ${currentYear}`,
      url: `${siteUrl}/calculator`,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description: metadata.description,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'CNY' },
      publisher: { '@type': 'Organization', name: siteName },
    }} />
    <CalculatorClient
      cities={cities}
      initialRule={initialCityRule.rule}
      initialRuleStatus={{ source: initialCityRule.source, fallbackReason: initialCityRule.fallbackReason }}
      incomeTaxRules={incomeTaxRules}
    />
  </>
}
