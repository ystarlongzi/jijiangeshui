import type { MetadataRoute } from 'next'
import { getIndexableArticles } from '@/lib/article-content-service'
import { getAvailableCityRules } from '@/lib/city-rule-service'
import { getIncomeTaxRuleDataset } from '@/lib/income-tax-rule-service'
import { getTaxRateSeoSelections, getTaxRateUrl } from '@/lib/tax-rate-page'
import { currentYear, siteUrl } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const coreRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/calculator`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${siteUrl}/tax-rate`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/bonus-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/business-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/labor-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/author-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/license-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/rental-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/property-transfer-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/dividend-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/accidental-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/reverse-tax`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/special-deductions`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/city`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/topics`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteUrl}/articles`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteUrl}/faq`, changeFrequency: 'monthly', priority: 0.6 },
  ]
  const [cityRules, articles, incomeTaxRules] = await Promise.all([
    getAvailableCityRules(),
    getIndexableArticles(),
    getIncomeTaxRuleDataset(),
  ])
  const defaultTaxYear = incomeTaxRules.availableYears[0] || currentYear
  const taxRateRoutes: MetadataRoute.Sitemap = incomeTaxRules.availableYears.flatMap((year) => getTaxRateSeoSelections(year)
    .map((selection) => getTaxRateUrl(selection, defaultTaxYear))
    // 默认居民工资入口已经由核心路由 /tax-rate 提供，避免 sitemap 出现重复 URL。
    .filter((path) => path !== '/tax-rate')
    .map((path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    })))
  const cityRoutes: MetadataRoute.Sitemap = Object.keys(cityRules).map((city) => ({
    url: `${siteUrl}/city/${city}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))
  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${siteUrl}/articles/${encodeURIComponent(article.slug)}`,
    lastModified: article.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))
  return [...coreRoutes, ...taxRateRoutes, ...cityRoutes, ...articleRoutes]
}
