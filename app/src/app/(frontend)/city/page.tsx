import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import SiteFooter from '../_components/SiteFooter'
import SiteHeader from '../_components/SiteHeader'
import { getAvailableCities } from '@/lib/city-rule-service'
import { currentYear, siteName } from '@/lib/site'
import CityRuleExplorer, { type CityRuleExplorerItem } from '../_features/city/CityRuleExplorer/CityRuleExplorer'
import styles from './CityPages.module.css'

export const metadata: Metadata = {
  title: `${currentYear}年城市个税计算器｜社保公积金基数范围｜${siteName}`,
  description: `查看北京、上海、深圳、广州、杭州等重点城市 ${currentYear} 年社保公积金基数范围，并进入对应城市工资个税计算器。`,
  alternates: { canonical: '/city' },
}

// 城市目录来自 CMS，按请求在服务端渲染，避免构建时把全部城市数据固化进静态产物。
export const dynamic = 'force-dynamic'

export default async function CityIndexPage() {
  const cities = await getAvailableCities({ all: true })
  const cityExplorerItems: CityRuleExplorerItem[] = cities.map((city) => ({
    key: city.slug,
    label: city.label,
    name: city.name,
    pinyin: city.pinyin,
    province: city.province,
  }))
  const popularCityKeys = ['beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chengdu']
  const popularCities = popularCityKeys
    .map((key) => cityExplorerItems.find((city) => city.key === key))
    .filter((city): city is CityRuleExplorerItem => Boolean(city))

  return <div className="app-shell"><SiteHeader active="calculator" /><main className={styles.page}>
    <CityRuleExplorer cities={cityExplorerItems} popularCities={popularCities} />

    <section className={`${styles.nextStep} ${styles.indexNextStep}`}><div><MapPin size={20} /><div><h2>城市规则会影响到手工资</h2><p>同样的税前工资，在不同城市可能因为社保、公积金基数上下限和单位比例不同，得到不同结果。</p></div></div><Link href="/calculator">进入工资计算器 <ArrowRight size={16} /></Link></section>
    <SiteFooter />
  </main></div>
}
