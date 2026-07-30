import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import SiteFooter from '../SiteFooter'
import SiteHeader from '../SiteHeader'
import { cityRules } from '@/lib/tax-rules'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `${currentYear}年城市个税计算器｜社保公积金基数范围｜${siteName}`,
  description: `查看北京、上海、深圳、广州、杭州等重点城市 ${currentYear} 年社保公积金基数范围，并进入对应城市工资个税计算器。`,
  alternates: { canonical: '/city' },
}

export default function CityIndexPage() {
  const cities = Object.entries(cityRules)
  const cityGroups = cities.reduce<Record<string, typeof cities>>((groups, city) => {
    const province = city[1].province
    groups[province] = [...(groups[province] || []), city]
    return groups
  }, {})
  return <div className="app-shell"><SiteHeader active="calculator" /><main className="city-page">
    <section className="city-hero city-index-hero">
      <div><div className="city-title-line"><MapPin size={20} /><span>{currentYear} 年城市规则</span></div><h1>城市个税计算器</h1><p>选择缴费城市，查看社保、公积金基数范围，并带入工资薪金计算器估算到手工资。</p></div>
    </section>

    <section className="city-index-grid" aria-label="已收录城市">
      {cities.map(([key, rule]) => <Link className="city-index-card" href={`/city/${key}`} key={key}>
        <span>{rule.label}</span><small>{rule.province} · {rule.pinyin}</small>
        <dl>
          <div><dt>社保基数</dt><dd>{formatMoney(rule.socialMin)} - {formatMoney(rule.socialMax)}</dd></div>
          <div><dt>公积金基数</dt><dd>{formatMoney(rule.housingMin)} - {formatMoney(rule.housingMax)}</dd></div>
        </dl>
        <strong>查看城市规则 <ArrowRight size={14} /></strong>
      </Link>)}
    </section>

    <section className="city-province-section" aria-label="按地区浏览城市">
      <div className="home-section-heading"><h2>按地区浏览</h2><p>先覆盖高频城市，后续接入规则后台后会扩展更多省市。</p></div>
      <div className="city-province-list">
        {Object.entries(cityGroups).map(([province, group]) => <div className="city-province-card" key={province}>
          <strong>{province}</strong>
          <div>{group.map(([key, rule]) => <Link href={`/city/${key}`} key={key}>{rule.name}</Link>)}</div>
        </div>)}
      </div>
    </section>

    <section className="city-next-step"><div><MapPin size={20} /><div><h2>城市规则会影响到手工资</h2><p>同样的税前工资，在不同城市可能因为社保、公积金基数上下限和单位比例不同，得到不同结果。</p></div></div><Link href="/calculator">进入工资计算器 <ArrowRight size={16} /></Link></section>
    <SiteFooter />
  </main></div>
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN')}`
}
