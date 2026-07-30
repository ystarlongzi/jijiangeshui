import Link from 'next/link'
import {
  ArrowRight,
  BadgePercent,
  BarChart3,
  BookOpen,
  Briefcase,
  BriefcaseBusiness,
  Calculator,
  CalendarRange,
  CircleHelp,
  Gift,
  Home,
  MapPin,
  Percent,
  ReceiptText,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import { currentYear, ruleCheckedDate, siteName, siteUrl } from '@/lib/site'

export const metadata = {
  title: `工资到手与个税计算器｜${siteName}`,
  description: `按城市、五险一金和专项扣除，测算 ${currentYear} 年工资到手、个人所得税与全年预扣逐月明细。`,
  alternates: { canonical: '/' },
}

const tools = [
  { href: '/calculator', icon: Calculator, title: '工资薪金', description: '按城市、基数和专项扣除，算清每月到手与全年预扣变化。', label: '开始计算', featured: true },
  { href: '/bonus-tax', icon: Gift, title: '年终奖', description: '对比单独计税与并入综合所得，看看哪种方式更合适。', label: '查看规则' },
  { href: '/business-tax', icon: Briefcase, title: '经营所得', description: '按年度收入、成本费用和损失，估算经营个税。', label: '开始计算' },
  { href: '/labor-tax', icon: BriefcaseBusiness, title: '劳务报酬', description: '按次或按月估算劳务报酬预扣税和税后到手。', label: '开始计算' },
  { href: '/author-tax', icon: BookOpen, title: '稿酬', description: '按费用扣除和减按 70% 规则，估算稿酬到手。', label: '开始计算' },
  { href: '/license-tax', icon: BadgePercent, title: '特许权使用费', description: '按费用扣除和 20% 比例预扣规则，估算税后收入。', label: '开始计算' },
  { href: '/rental-tax', icon: Home, title: '财产租赁', description: '输入租金、税费和修缮费，估算出租收入个税。', label: '开始计算' },
  { href: '/property-transfer-tax', icon: TrendingUp, title: '财产转让', description: '按收入、原值和合理费用，估算转让所得个税。', label: '开始计算' },
  { href: '/reverse-tax', icon: ReceiptText, title: '税后反推', description: '输入期望到手工资，反推需要的税前收入。', label: '查看说明' },
  { href: '/special-deductions', icon: Sparkles, title: '专项扣除', description: '按子女教育、租金、房贷和赡养老人等项目，算出本月可扣金额。', label: '开始计算' },
  { href: '/tax-rate', icon: Percent, title: '税率表', description: '快速查看工资薪金累计预扣预缴税率和速算扣除数。', label: '查看税率' },
  { href: '/faq', icon: CircleHelp, title: '常见问题', description: '理解累计预扣、社保基数和全年汇算之间的关系。', label: '查看问答' },
]

const highlights = [
  { icon: MapPin, title: '城市规则', text: '社保、公积金基数范围随城市变化，前提透明可核对。' },
  { icon: CalendarRange, title: '全年明细', text: '逐月查看累计收入、扣除、预扣率和本月个税。' },
  { icon: BarChart3, title: '结果解释', text: '不只告诉你数字，还说明本月为什么变化。' },
]

export default function HomePage() {
  const websiteStructuredData = { '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: siteUrl, description: `按城市、五险一金和专项扣除，测算 ${currentYear} 年工资到手与全年预扣个税。` }
  return <div className="app-shell">
    <SiteHeader active="home" />
    <main className="home-page" id="top">
    <section className="home-hero">
      <div className="home-hero-copy">
        <h1>先看懂，<br />再算清。</h1>
        <p className="home-lead">从工资到手、社保公积金，到全年预扣变化，把每个数字讲明白。</p>
        <div className="home-actions"><Link className="home-primary-action" href="/calculator">开始算工资 <ArrowRight size={17} /></Link><Link className="home-secondary-action" href="/tax-rate">先看税率表</Link></div>
      </div>
      <div className="hero-snapshot" aria-label="工资去向概览">
        <div className="hero-snapshot-top"><span>工资去向概览</span><strong>{currentYear}</strong></div>
        <div className="hero-snapshot-total"><span>税前月薪</span><strong>¥20,000</strong></div>
        <div className="hero-snapshot-bar"><span className="bar-take-home" /><span className="bar-insurance" /><span className="bar-tax" /></div>
        <div className="hero-snapshot-legend"><span><i className="legend-dot take-home" />到手工资 <b>¥15,710</b></span><span><i className="legend-dot insurance" />五险一金 <b>¥3,100</b></span><span><i className="legend-dot tax" />个人所得税 <b>¥1,190</b></span></div>
        <p>按北京市规则估算 · 8 月</p>
      </div>
      <div className="home-hero-note"><span className="status-dot" /><span>规则核对日期</span><strong>{ruleCheckedDate}</strong></div>
    </section>

    <section className="home-tool-section" aria-labelledby="home-tools-title">
      <div className="home-section-heading"><h2 id="home-tools-title">你想算什么？</h2><p>从最常用的工资计算开始，也可以直接进入对应的政策工具。</p></div>
      <div className="tool-grid">{tools.map(({ href, icon: Icon, title, description, label, featured }) => <Link className={`tool-entry${featured ? ' featured' : ''}`} href={href} key={title}><span className="tool-icon"><Icon size={21} strokeWidth={1.8} /></span><span className="tool-entry-body"><strong>{title}</strong><span>{description}</span></span><span className="tool-entry-action">{label}<ArrowRight size={15} /></span></Link>)}</div>
    </section>

    <section className="home-highlight-section" aria-label="产品特点"><div className="highlight-grid">{highlights.map(({ icon: Icon, title, text }) => <div className="highlight-item" key={title}><Icon className="highlight-icon" size={20} strokeWidth={1.8} /><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></section>

    <section className="home-reading-section"><div className="home-section-heading"><h2>常用规则与内容</h2><Link href="/faq">查看全部 <ArrowRight size={15} /></Link></div><div className="reading-links"><Link href="/tax-rate"><Percent size={18} /><span>个人所得税预扣率表</span><ArrowRight size={15} /></Link><Link href="/special-deductions"><BookOpen size={18} /><span>专项附加扣除计算器</span><ArrowRight size={15} /></Link><Link href="/faq"><CircleHelp size={18} /><span>工资个税常见问题</span><ArrowRight size={15} /></Link></div></section>

    <section className="home-city-section"><div className="home-section-heading"><h2>热门城市</h2><Link href="/city">全部城市 <ArrowRight size={15} /></Link></div><p className="home-section-copy">查看城市社保、公积金基数范围和缴费比例。</p><div className="city-links"><Link href="/city/beijing"><MapPin size={16} />北京市 <ArrowRight size={14} /></Link><Link href="/city/shanghai"><MapPin size={16} />上海市 <ArrowRight size={14} /></Link><Link href="/city/shenzhen"><MapPin size={16} />深圳市 <ArrowRight size={14} /></Link><Link href="/city/guangzhou"><MapPin size={16} />广州市 <ArrowRight size={14} /></Link><Link href="/city/hangzhou"><MapPin size={16} />杭州市 <ArrowRight size={14} /></Link></div></section>

    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }} />
    <SiteFooter />
    </main>
  </div>
}
