import type { Metadata } from 'next'
import { siteName, siteUrl } from '@/lib/site'
import AnalyticsReporter from './_components/AnalyticsReporter'
import AnalyticsScripts from './_components/AnalyticsScripts'
import { MoneyFormatProvider } from './_components/MoneyFormatProvider'

import './calculator.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteName,
  description: '看懂工资到手、五险一金与全年预扣变化。',
  alternates: { canonical: '/' },
  openGraph: { siteName, type: 'website', locale: 'zh_CN' },
}

// 前台页面依赖 Payload 中的城市和税务规则，必须由生产 Node 服务在请求时读取，不能在无生产数据库的 CI 构建阶段固化 fallback 数据。
export const dynamic = 'force-dynamic'

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body><AnalyticsScripts /><MoneyFormatProvider><AnalyticsReporter />{children}</MoneyFormatProvider></body>
    </html>
  )
}
