import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import SiteFooter from '../_components/SiteFooter'
import SiteHeader from '../_components/SiteHeader'
import SectionHeading from '../_components/SectionHeading'
import { getContributionBaseRule, type CityRule } from '@/lib/tax-rules'
import { getAvailableCityRules } from '@/lib/city-rule-service'
import { getCityRuleStats, hasRuleSourceUrl } from '@/lib/city-rule-quality'
import { currentYear, siteName } from '@/lib/site'
import styles from './CityPages.module.css'

export const metadata: Metadata = {
  title: `${currentYear}年城市个税计算器｜社保公积金基数范围｜${siteName}`,
  description: `查看北京、上海、深圳、广州、杭州等重点城市 ${currentYear} 年社保公积金基数范围，并进入对应城市工资个税计算器。`,
  alternates: { canonical: '/city' },
}

export default async function CityIndexPage() {
  const cityRules = await getAvailableCityRules()
  const cities = Object.entries(cityRules)
  const cityStats = getCityRuleStats(cities, currentYear)
  const cityGroups = cities.reduce<Record<string, typeof cities>>((groups, city) => {
    const province = city[1].province
    groups[province] = [...(groups[province] || []), city]
    return groups
  }, {})
  return <div className="app-shell"><SiteHeader active="calculator" /><main className={styles.page}>
    <section className={`${styles.hero} ${styles.indexHero}`}>
      <div><div className={styles.titleLine}><MapPin size={20} /><span>{currentYear} 年城市规则</span></div><h1>城市个税计算器</h1><p>选择缴费城市，查看社保、公积金基数范围，并带入工资薪金计算器估算到手工资。</p></div>
    </section>

    <section className={styles.coveragePanel} aria-label="城市规则覆盖状态">
      <div><span>已收录城市</span><strong>{cityStats.total}</strong></div>
      <div><span>{currentYear} 年规则</span><strong>{cityStats.currentYearRules}</strong></div>
      <div><span>已配置来源</span><strong>{cityStats.withSourceUrl}</strong></div>
      <div><span>来源待补</span><strong>{cityStats.missingSourceUrl}</strong></div>
    </section>

    <section className={styles.indexGrid} aria-label="已收录城市">
      {cities.map(([key, rule]) => <Link className={styles.indexCard} href={`/city/${key}`} key={key}>
        <span>{rule.label}</span><small>{rule.province} · {rule.pinyin}</small>
        <dl>
          <div><dt>社保基数</dt><dd>{formatBaseRange(rule, 'social')}</dd></div>
          <div><dt>公积金基数</dt><dd>{formatBaseRange(rule, 'housingFund')}</dd></div>
        </dl>
        <div className={styles.ruleMeta}>
          <span>生效 {rule.effective}</span>
          <span className={hasRuleSourceUrl(rule) ? styles.okStatus : styles.warnStatus}>{hasRuleSourceUrl(rule) ? '已配置来源' : '来源待补'}</span>
        </div>
        <strong>查看城市规则 <ArrowRight size={14} /></strong>
      </Link>)}
    </section>

    <section className={styles.provinceSection} aria-label="按地区浏览城市">
      <SectionHeading title="按地区浏览" description="先覆盖高频城市，后续接入规则后台后会扩展更多省市。" />
      <div className={styles.provinceList}>
        {Object.entries(cityGroups).map(([province, group]) => <div className={styles.provinceCard} key={province}>
          <strong>{province}</strong>
          <div>{group.map(([key, rule]) => <Link href={`/city/${key}`} key={key}>{rule.name}</Link>)}</div>
        </div>)}
      </div>
    </section>

    <section className={styles.nextStep}><div><MapPin size={20} /><div><h2>城市规则会影响到手工资</h2><p>同样的税前工资，在不同城市可能因为社保、公积金基数上下限和单位比例不同，得到不同结果。</p></div></div><Link href="/calculator">进入工资计算器 <ArrowRight size={16} /></Link></section>
    <SiteFooter />
  </main></div>
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN')}`
}

function formatBaseRange(rule: CityRule, type: 'social' | 'housingFund') {
  const baseRule = getContributionBaseRule(rule, type)
  return `${formatMoney(baseRule.min)} - ${formatMoney(baseRule.max)}`
}
