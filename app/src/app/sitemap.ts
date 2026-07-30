import type { MetadataRoute } from 'next'
import { cityRules } from '@/lib/tax-rules'
import { siteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
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
    { url: `${siteUrl}/faq`, changeFrequency: 'monthly', priority: 0.6 },
  ]
  const cityRoutes: MetadataRoute.Sitemap = Object.keys(cityRules).map((city) => ({
    url: `${siteUrl}/city/${city}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))
  return [...coreRoutes, ...cityRoutes]
}
