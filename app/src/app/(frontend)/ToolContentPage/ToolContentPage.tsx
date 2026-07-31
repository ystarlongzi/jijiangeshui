import { ArrowRight } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import SiteHeader from '../SiteHeader'
import PrimaryActionLink from '../PrimaryActionLink'
import Link from 'next/link'
import styles from './ToolContentPage.module.css'

type ContentSection = { title: string; description: string; items?: string[] }
type ContentPage = 'bonus-tax' | 'reverse-tax' | 'special-deductions' | 'faq'

export default function ToolContentPage({ eyebrow, title, description, sections, action, active }: { eyebrow: string; title: string; description: string; sections: ContentSection[]; action: { href: string; label: string }; active: ContentPage }) {
  return <div className="app-shell"><SiteHeader active={active} /><main className={styles.page}>
    <header className={styles.hero}><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className={styles.lead}>{description}</p><PrimaryActionLink href={action.href}>{action.label} <ArrowRight size={16} /></PrimaryActionLink></header>
    <div className={styles.sections}>{sections.map((section) => <section className={styles.section} key={section.title}><h2>{section.title}</h2><p>{section.description}</p>{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}</div>
    <div className={styles.bottomAction}><Link href={action.href}>{action.label} <ArrowRight size={15} /></Link></div>
    <SiteFooter />
  </main></div>
}
