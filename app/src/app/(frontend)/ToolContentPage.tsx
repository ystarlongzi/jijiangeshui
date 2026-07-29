import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'

type ContentSection = { title: string; description: string; items?: string[] }
type ContentPage = 'bonus-tax' | 'reverse-tax' | 'special-deductions' | 'faq'

export default function ToolContentPage({ eyebrow, title, description, sections, action, active }: { eyebrow: string; title: string; description: string; sections: ContentSection[]; action: { href: string; label: string }; active: ContentPage }) {
  return <div className="app-shell"><SiteHeader active={active} /><main className="info-page">
    <header className="info-hero"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="info-lead">{description}</p><Link className="home-primary-action" href={action.href}>{action.label} <ArrowRight size={16} /></Link></header>
    <div className="info-sections">{sections.map((section) => <section className="info-section" key={section.title}><h2>{section.title}</h2><p>{section.description}</p>{section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}</div>
    <div className="info-bottom-action"><Link href={action.href}>{action.label} <ArrowRight size={15} /></Link></div>
    <SiteFooter />
  </main></div>
}
