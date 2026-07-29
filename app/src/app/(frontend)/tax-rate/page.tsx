import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, Calculator } from 'lucide-react'
import { currentYear, siteName } from '@/lib/site'
import TaxRateTabs from './TaxRateTabs'

export const metadata: Metadata = {
  title: `税率表｜${currentYear}年个人所得税预扣规则｜${siteName}`,
  description: `${currentYear}年个人所得税税率表和预扣规则，支持工资薪金、劳务报酬、稿酬、特许权使用费和非居民个人所得。`,
}

export default function TaxRatePage() {
  return <main className="rate-page">
    <nav className="city-breadcrumb"><Link href="/">极简个税</Link><span>/</span><span>个人所得税税率表</span></nav>
    <header className="rate-page-header"><div><div className="rate-title-line"><BookOpen size={20} /><span>{currentYear} 年个人所得税规则</span></div><h1>税率表</h1><p>工资薪金、劳务报酬、稿酬及其他所得，分别适用不同的税率和计税规则。</p></div><Link className="home-primary-action" href="/calculator">用税率表算工资 <Calculator size={16} /></Link></header>
    <TaxRateTabs />
    <section className="rate-explanation"><div><h2>看完税率表，下一步做什么？</h2><p>先确认自己的所得类型，再进入对应计算器。工资薪金用户可以输入城市、工资和五险一金，查看本月到手与全年逐月变化；专项扣除也会影响最终结果。</p></div><div className="rate-next-actions"><Link href="/calculator">算工资到手 <ArrowRight size={15} /></Link><Link href="/calculator#deduction">看专项扣除 <ArrowRight size={15} /></Link></div></section>
    <section className="rate-faq"><h2>常见问题</h2><details open><summary>工资一样，为什么每个月个税可能不同？</summary><p>工资薪金通常采用累计预扣法。累计收入、累计扣除和已预扣税额会随着月份变化，所以本月个税不一定固定。</p></details><details><summary>劳务报酬、稿酬也有自己的税率表吗？</summary><p>有。居民个人劳务报酬适用预扣率表二，稿酬和特许权使用费通常适用 20% 比例预扣率；非居民个人还要根据对应的非居民税率表计算。</p></details><details><summary>这张表可以用于年终奖吗？</summary><p>年终奖可能适用单独计税或并入综合所得等不同口径，不能直接套用本表判断，建议使用年终奖专项计算器进行对比。</p></details></section>
    <div className="rate-bottom-actions"><Link href="/calculator"><Calculator size={16} />返回工资计算器</Link><Link href="/">返回首页 <ArrowRight size={16} /></Link></div>
  </main>
}
