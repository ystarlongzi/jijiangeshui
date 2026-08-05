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

export function serializeJsonLd(data: JsonLdProps['data']): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export default function JsonLd({ data }: JsonLdProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
