'use client'

import { useState } from 'react'
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import { useMoneyFormat } from './MoneyFormatProvider'
import { ArrowUpRight, Calculator, FileText, Gift, Home, Menu, Percent, Sparkles, X } from 'lucide-react'

type ActivePage = 'home' | 'calculator' | 'bonus-tax' | 'reverse-tax' | 'special-deductions' | 'tax-rate' | 'faq'

export default function SiteHeader({ active }: { active: ActivePage }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { grouping, toggleGrouping } = useMoneyFormat()
  const closeMenu = () => setMenuOpen(false)

  return <header className={`topbar${menuOpen ? ' menu-open' : ''}`}>
    <Link className="brand" href="/" aria-label="极简个税首页"><span className="brand-mark">极</span><span>极简个税</span></Link>
    <nav className="main-nav" aria-label="主导航">
      <Link className={active === 'home' ? 'active' : ''} href="/" onClick={closeMenu}><Home size={15} />首页</Link>
      <Link className={active === 'calculator' ? 'active' : ''} href="/calculator" onClick={closeMenu}><Calculator size={15} />工资薪金</Link>
      <Link className={active === 'bonus-tax' ? 'active' : ''} href="/bonus-tax" onClick={closeMenu}><Gift size={15} />年终奖</Link>
      <Link className={active === 'reverse-tax' ? 'active' : ''} href="/reverse-tax" onClick={closeMenu}><ArrowUpRight size={15} />税后反推</Link>
      <Link className={active === 'special-deductions' ? 'active' : ''} href="/special-deductions" onClick={closeMenu}><Sparkles size={15} />专项扣除</Link>
      <Link className={active === 'tax-rate' ? 'active' : ''} href="/tax-rate" onClick={closeMenu}><Percent size={15} />税率表</Link>
      <Link className={active === 'faq' ? 'active' : ''} href="/faq" onClick={closeMenu}><FileText size={15} />FAQ</Link>
    </nav>
    {menuOpen && <button className="mobile-menu-backdrop" aria-label="关闭导航菜单" onClick={closeMenu} />}
    <div className="topbar-actions">
      <button className="mobile-menu-button" type="button" aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      <button className="format-toggle" type="button" aria-label="切换金额分组方式" title={grouping === 'thousand' ? '当前：千位分组，点击切换为万位分组' : '当前：万位分组，点击切换为千位分组'} onClick={toggleGrouping}>{grouping === 'thousand' ? '千' : '万'}</button>
      <ThemeToggle />
    </div>
  </header>
}
