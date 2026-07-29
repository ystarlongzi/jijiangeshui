import type { Metadata } from 'next'

import './calculator.css'

export const metadata: Metadata = {
  title: '极简个税',
  description: '看懂工资到手与全年个税变化。',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
