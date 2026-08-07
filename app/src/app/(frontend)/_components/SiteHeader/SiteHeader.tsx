'use client'

import { useState } from 'react'
import Link from 'next/link'
import ThemeToggle from '../ThemeToggle'
import { useMoneyFormat } from '../MoneyFormatProvider'
import { trackEvent } from '../../_lib/analytics'
import { ArrowUpRight, Calculator, FileText, Gift, Home, Menu, Percent, Sparkles, X } from 'lucide-react'
import styles from './SiteHeader.module.css'

type ActivePage = 'home' | 'calculator' | 'bonus-tax' | 'reverse-tax' | 'special-deductions' | 'tax-rate' | 'faq'

export default function SiteHeader({ active }: { active?: ActivePage }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { grouping, setGrouping } = useMoneyFormat()
  const closeMenu = () => setMenuOpen(false)
  const toggleMenu = () => {
    setMenuOpen((open) => {
      const next = !open
      trackEvent('mobile_menu_toggle', { open: next })
      return next
    })
  }
  const toggleGrouping = () => {
    const next = grouping === 'thousand' ? 'wan' : 'thousand'
    setGrouping(next)
    trackEvent('money_grouping_change', { grouping: next })
  }

  const topbarClassName = `${styles.topbar}${menuOpen ? ` ${styles.menuOpen}` : ''}`

  return <header className={topbarClassName}>
    <Link className={styles.brand} href="/" aria-label="极简个税首页"><span className={styles.brandMark}>极</span><span>极简个税</span></Link>
    <nav className={styles.nav} aria-label="主导航">
      <Link className={active === 'home' ? styles.active : ''} href="/" onClick={closeMenu}><Home size={15} />首页</Link>
      <Link className={active === 'calculator' ? styles.active : ''} href="/calculator" onClick={closeMenu}><Calculator size={15} />工资薪金</Link>
      <Link className={active === 'bonus-tax' ? styles.active : ''} href="/bonus-tax" onClick={closeMenu}><Gift size={15} />年终奖</Link>
      <Link className={active === 'reverse-tax' ? styles.active : ''} href="/reverse-tax" onClick={closeMenu}><ArrowUpRight size={15} />税后反推</Link>
      <Link className={active === 'special-deductions' ? styles.active : ''} href="/special-deductions" onClick={closeMenu}><Sparkles size={15} />专项扣除</Link>
      <Link className={active === 'tax-rate' ? styles.active : ''} href="/tax-rate" onClick={closeMenu}><Percent size={15} />税率表</Link>
      <Link className={active === 'faq' ? styles.active : ''} href="/faq" onClick={closeMenu}><FileText size={15} />FAQ</Link>
    </nav>
    {menuOpen && <button className={styles.mobileMenuBackdrop} aria-label="关闭导航菜单" onClick={closeMenu} />}
    <div className={styles.actions}>
      <button className={styles.mobileMenuButton} type="button" aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={menuOpen} onClick={toggleMenu}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      <button className={styles.formatToggle} type="button" aria-label="切换金额分组方式" title={grouping === 'thousand' ? '当前：千位分组，点击切换为万位分组' : '当前：万位分组，点击切换为千位分组'} onClick={toggleGrouping}>{grouping === 'thousand' ? '千' : '万'}</button>
      <ThemeToggle />
    </div>
  </header>
}
