import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import SiteFooter from '../_components/SiteFooter'
import SiteHeader from '../_components/SiteHeader'
import SectionHeading from '../_components/SectionHeading'
import { getContributionBaseRule, type CityRule } from '@/lib/tax-rules'
import { getAvailableCityRuleDataset, getCityRuleDatasetSummary } from '@/lib/city-rule-service'
import { getCityRuleStats, hasRuleSourceUrl } from '@/lib/city-rule-quality'
import { currentYear, siteName } from '@/lib/site'
import CityRuleExplorer, { type CityRuleExplorerItem } from '../_features/city/CityRuleExplorer/CityRuleExplorer'
import { getCityRuleSourceBadgeLabel, getCityRuleSourceCoverage, getCityRuleSourceStatus } from '../_lib/cityRuleSource'
import styles from './CityPages.module.css'

export const metadata: Metadata = {
  title: `${currentYear}年城市个税计算器｜社保公积金基数范围｜${siteName}`,
  description: `查看北京、上海、深圳、广州、杭州等重点城市 ${currentYear} 年社保公积金基数范围，并进入对应城市工资个税计算器。`,
  alternates: { canonical: '/city' },
}

export default async function CityIndexPage() {
  const cityRuleDataset = await getAvailableCityRuleDataset()
  const cityRules = cityRuleDataset.rules
  const cities = Object.entries(cityRules).sort(([, prev], [, next]) => {
    const provinceOrder = prev.province.localeCompare(next.province, 'zh-CN')
    if (provinceOrder !== 0) return provinceOrder
    return prev.label.localeCompare(next.label, 'zh-CN')
  })
  const cityStats = getCityRuleStats(cities, currentYear)
  const isPayloadSource = cityRuleDataset.source === 'payload'
  const datasetSummary = getCityRuleDatasetSummary(cityRuleDataset)
  const cmsCoverage = isPayloadSource ? `${cityRuleDataset.cmsActivePolicyCities}/${cityRuleDataset.cmsEnabledCities}` : '未接入'
  const sourceCoverage = getCityRuleSourceCoverage(cities.map(([key]) => key), cityRuleDataset.ruleSourcesByCity)
  const cityGroups = cities.reduce<Record<string, typeof cities>>((groups, city) => {
    const province = city[1].province
    groups[province] = [...(groups[province] || []), city]
    return groups
  }, {})
  const cityExplorerItems: CityRuleExplorerItem[] = cities.map(([key, rule]) => {
    const sourceStatus = getCityRuleSourceStatus({
      city: key,
      ruleDatasetSummary: datasetSummary,
      ruleSourcesByCity: cityRuleDataset.ruleSourcesByCity,
    })

    return {
      effective: rule.effective,
      housingBaseRange: formatBaseRange(rule, 'housingFund'),
      key,
      label: rule.label,
      name: rule.name,
      pinyin: rule.pinyin,
      province: rule.province,
      socialBaseRange: formatBaseRange(rule, 'social'),
      sourceLabel: sourceStatus.label,
      sourceReady: hasRuleSourceUrl(rule),
      sourceType: sourceStatus.source,
    }
  })

  return <div className="app-shell"><SiteHeader active="calculator" /><main className={styles.page}>
    <section className={`${styles.hero} ${styles.indexHero}`}>
      <div><div className={styles.titleLine}><MapPin size={20} /><span>{currentYear} 年城市规则</span></div><h1>城市个税计算器</h1><p>选择缴费城市，查看社保、公积金基数范围，并带入工资薪金计算器估算到手工资。</p></div>
    </section>

    <section className={styles.coveragePanel} aria-label="城市规则覆盖状态">
      <div><span>前台规则来源</span><strong className={styles.sourceValue}>{datasetSummary.sourceLabel}</strong><small>{datasetSummary.sourceDetail}</small></div>
      <div><span>CMS 有效城市</span><strong>{cmsCoverage}</strong></div>
      <div><span>前台可用城市</span><strong>{cityStats.usableRules}</strong><small>CMS {sourceCoverage.payload} 个 · 兜底 {sourceCoverage.fallback} 个</small></div>
      <div><span>CMS 覆盖率</span><strong>{sourceCoverage.payloadRate}%</strong><small>{sourceCoverage.payload}/{sourceCoverage.total} 个城市</small></div>
      <div><span>来源待补</span><strong>{cityStats.missingSourceUrl}</strong><small>URL 覆盖率 {cityStats.sourceUrlCoverageRate}%</small></div>
    </section>

    <CityRuleExplorer cities={cityExplorerItems} />

    <section className={styles.provinceSection} aria-label="按地区浏览城市">
      <SectionHeading title="按地区浏览" description="按省份汇总已收录城市，进入城市页后可查看当地社保、公积金基数范围和默认比例。" />
      <div className={styles.provinceList}>
        {Object.entries(cityGroups).map(([province, group]) => <div className={styles.provinceCard} key={province}>
          <strong>{province}</strong>
          <div>{group.map(([key, rule]) => {
            const sourceStatus = getCityRuleSourceStatus({
              city: key,
              ruleDatasetSummary: datasetSummary,
              ruleSourcesByCity: cityRuleDataset.ruleSourcesByCity,
            })

            return <Link className={styles.cityLink} href={`/city/${key}`} key={key}>
              <span>{rule.name}</span>
              <small data-source={sourceStatus.source}>{getCityRuleSourceBadgeLabel(sourceStatus.source)}</small>
            </Link>
          })}</div>
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
