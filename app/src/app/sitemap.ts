import type { MetadataRoute } from 'next'
import { getIndexableArticles } from '@/lib/article-content-service'
import { getAvailableCities } from '@/lib/city-rule-service'
import { getIncomeTaxRuleDataset } from '@/lib/income-tax-rule-service'
import { getTaxRateSeoSelections, getTaxRateUrl } from '@/lib/tax-rate-page'
import { currentYear, siteUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function sitemapUrl(path: string) {
  return escapeXml(`${siteUrl}${path}`)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const coreRoutes: MetadataRoute.Sitemap = [
    { url: sitemapUrl(''), changeFrequency: 'weekly', priority: 1 },
    { url: sitemapUrl('/calculator'), changeFrequency: 'monthly', priority: 0.9 },
    { url: sitemapUrl('/tax-rate'), changeFrequency: 'monthly', priority: 0.8 },
    { url: sitemapUrl('/bonus-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/business-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/labor-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/author-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/license-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/rental-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/property-transfer-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/dividend-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/accidental-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/reverse-tax'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/special-deductions'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/city'), changeFrequency: 'monthly', priority: 0.7 },
    { url: sitemapUrl('/topics'), changeFrequency: 'weekly', priority: 0.7 },
    { url: sitemapUrl('/articles'), changeFrequency: 'weekly', priority: 0.7 },
    { url: sitemapUrl('/faq'), changeFrequency: 'monthly', priority: 0.6 },
  ]
  const [cities, articles, incomeTaxRules] = await Promise.all([
    getAvailableCities({ all: true }),
    getIndexableArticles(),
    getIncomeTaxRuleDataset(),
  ])
  const defaultTaxYear = incomeTaxRules.availableYears[0] || currentYear
  const taxRateRoutes: MetadataRoute.Sitemap = incomeTaxRules.availableYears.flatMap((year) => getTaxRateSeoSelections(year)
    .map((selection) => getTaxRateUrl(selection, defaultTaxYear))
    // 默认居民工资入口已经由核心路由 /tax-rate 提供，避免 sitemap 出现重复 URL。
    .filter((path) => path !== '/tax-rate')
    .map((path) => ({
      url: sitemapUrl(path),
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    })))
  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: sitemapUrl(`/city/${city.slug}`),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))
  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
    url: sitemapUrl(`/articles/${encodeURIComponent(article.slug)}`),
    lastModified: article.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))
  return [...coreRoutes, ...taxRateRoutes, ...cityRoutes, ...articleRoutes]
}
