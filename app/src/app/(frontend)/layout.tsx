import type { Metadata } from 'next'
import { siteName, siteUrl } from '@/lib/site'

import './calculator.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteName,
  description: '看懂工资到手与全年个税变化。',
  alternates: { canonical: '/' },
  openGraph: { siteName, type: 'website', locale: 'zh_CN' },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
