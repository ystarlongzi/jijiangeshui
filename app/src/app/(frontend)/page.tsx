import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarRange,
  CircleHelp,
  Gift,
  MapPin,
  Percent,
  ReceiptText,
  Sparkles,
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import { currentYear, siteName } from '@/lib/site'

export const metadata = {
  title: `工资到手与个税计算器｜${siteName}`,
  description: `按城市、五险一金和专项扣除，测算 ${currentYear} 年工资到手、个人所得税与全年逐月明细。`,
}

const tools = [
  { href: '/calculator', icon: Calculator, title: '工资薪金', description: '按城市、基数和专项扣除，算清每月到手与全年变化。', label: '开始计算', featured: true },
  { href: '/calculator#bonus', icon: Gift, title: '年终奖', description: '对比单独计税与并入综合所得，看看哪种方式更合适。', label: '即将上线' },
  { href: '/calculator#reverse', icon: ReceiptText, title: '税后反推', description: '输入期望到手工资，反推需要的税前收入。', label: '即将上线' },
  { href: '/calculator#deduction', icon: Sparkles, title: '专项扣除', description: '查看子女教育、租金、房贷和赡养老人等扣除标准。', label: '查看说明' },
  { href: '/tax-rate', icon: Percent, title: '税率表', description: '快速查看工资薪金累计预扣预缴税率和速算扣除数。', label: '查看税率' },
  { href: '/calculator#faq', icon: CircleHelp, title: '常见问题', description: '理解累计预扣、社保基数和全年汇算之间的关系。', label: '查看问答' },
]

const highlights = [
  { icon: MapPin, title: '城市规则', text: '社保、公积金基数范围随城市变化，前提透明可核对。' },
  { icon: CalendarRange, title: '全年明细', text: '逐月查看累计收入、扣除、税率和本月个税。' },
  { icon: BarChart3, title: '结果解释', text: '不只告诉你数字，还说明本月为什么变化。' },
]

export default function HomePage() {
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="极简个税首页"><span className="brand-mark">极</span><span>极简个税</span></a>
      <nav className="main-nav" aria-label="主导航"><a className="active" href="#top">首页</a><a href="/calculator">工资薪金</a><a href="/calculator#bonus">年终奖</a><a href="/calculator#reverse">税后反推</a><a href="/calculator#deduction">专项扣除</a><a href="/tax-rate">税率表</a><a href="/calculator#faq">FAQ</a></nav>
      <ThemeToggle />
    </header>
    <main className="home-page" id="top">
    <section className="home-hero">
      <div className="home-hero-copy">
        <h1>先看懂，<br />再算清。</h1>
        <p className="home-lead">从工资到手、社保公积金，到全年个税变化，把每个数字讲明白。</p>
        <div className="home-actions"><Link className="home-primary-action" href="/calculator">开始算工资 <ArrowRight size={17} /></Link><Link className="home-secondary-action" href="/tax-rate">先看税率表</Link></div>
      </div>
      <div className="home-hero-note"><span className="status-dot" /><span>规则核对日期</span><strong>{currentYear}-07-27</strong></div>
    </section>

    <section className="home-tool-section" aria-labelledby="home-tools-title">
      <div className="home-section-heading"><h2 id="home-tools-title">你想算什么？</h2><p>从最常用的工资计算开始，也可以直接进入对应的政策工具。</p></div>
      <div className="tool-grid">{tools.map(({ href, icon: Icon, title, description, label, featured }) => <Link className={`tool-entry${featured ? ' featured' : ''}`} href={href} key={title}><span className="tool-icon"><Icon size={21} strokeWidth={1.8} /></span><span className="tool-entry-body"><strong>{title}</strong><span>{description}</span></span><span className="tool-entry-action">{label}<ArrowRight size={15} /></span></Link>)}</div>
    </section>

    <section className="home-highlight-section" aria-label="产品特点"><div className="highlight-grid">{highlights.map(({ icon: Icon, title, text }) => <div className="highlight-item" key={title}><Icon className="highlight-icon" size={20} strokeWidth={1.8} /><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></section>

    <section className="home-reading-section"><div className="home-section-heading"><h2>常用规则与内容</h2><Link href="/calculator#faq">查看全部 <ArrowRight size={15} /></Link></div><div className="reading-links"><Link href="/tax-rate"><Percent size={18} /><span>个人所得税预扣率表</span><ArrowRight size={15} /></Link><Link href="/calculator#deduction"><BookOpen size={18} /><span>专项附加扣除说明</span><ArrowRight size={15} /></Link><Link href="/calculator#faq"><CircleHelp size={18} /><span>工资个税常见问题</span><ArrowRight size={15} /></Link></div></section>

    <section className="home-city-section"><div className="home-section-heading"><h2>热门城市</h2><p>查看城市社保、公积金基数范围和缴费比例。</p></div><div className="city-links"><Link href="/city/beijing"><MapPin size={16} />北京市 <ArrowRight size={14} /></Link><Link href="/city/shanghai"><MapPin size={16} />上海市 <ArrowRight size={14} /></Link><Link href="/city/shenzhen"><MapPin size={16} />深圳市 <ArrowRight size={14} /></Link><Link href="/city/guangzhou"><MapPin size={16} />广州市 <ArrowRight size={14} /></Link><Link href="/city/hangzhou"><MapPin size={16} />杭州市 <ArrowRight size={14} /></Link></div></section>

    <footer className="home-footer"><span>极简个税 · 让每个数字都能被解释</span><span>仅供测算，最终以官方和扣缴单位口径为准</span></footer>
    </main>
  </div>
}
