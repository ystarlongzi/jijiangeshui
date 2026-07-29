'use client'

import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

type ActivePage = 'home' | 'calculator' | 'tax-rate'

export default function SiteHeader({ active }: { active: ActivePage }) {
  return <header className="topbar">
    <Link className="brand" href="/" aria-label="极简个税首页"><span className="brand-mark">极</span><span>极简个税</span></Link>
    <nav className="main-nav" aria-label="主导航">
      <Link className={active === 'home' ? 'active' : ''} href="/">首页</Link>
      <Link className={active === 'calculator' ? 'active' : ''} href="/calculator">工资薪金</Link>
      <Link href="/calculator#bonus">年终奖</Link>
      <Link href="/calculator#reverse">税后反推</Link>
      <Link href="/calculator#deduction">专项扣除</Link>
      <Link className={active === 'tax-rate' ? 'active' : ''} href="/tax-rate">税率表</Link>
      <Link href="/calculator#faq">FAQ</Link>
    </nav>
    <ThemeToggle />
  </header>
}
