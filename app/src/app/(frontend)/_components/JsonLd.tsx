type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[]
}

export function createCalculatorJsonLd({ name, description, url, siteName }: { name: string; description: unknown; url: string; siteName: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'CNY' },
    publisher: { '@type': 'Organization', name: siteName },
  }
}

export default function JsonLd({ data }: JsonLdProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
