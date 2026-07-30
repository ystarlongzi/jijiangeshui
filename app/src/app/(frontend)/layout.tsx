import type { Metadata } from 'next'
import { siteName, siteUrl } from '@/lib/site'
import AnalyticsReporter from './AnalyticsReporter'
import { MoneyFormatProvider } from './MoneyFormatProvider'

import './calculator.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteName,
  description: '看懂工资到手、五险一金与全年预扣变化。',
  alternates: { canonical: '/' },
  openGraph: { siteName, type: 'website', locale: 'zh_CN' },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body><MoneyFormatProvider><AnalyticsReporter />{children}</MoneyFormatProvider></body>
    </html>
  )
}
