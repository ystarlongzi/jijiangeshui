import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Calculator, MapPin, ShieldCheck } from 'lucide-react'
import { getContributionBaseRule, getHousingRateOptions } from '@/lib/tax-rules'
import { getAvailableCityRule, getAvailableCityRules } from '@/lib/city-rule-service'
import { calculateInsurance, calculateMonth } from '@/lib/tax-calculator'
import { currentYear, siteName } from '@/lib/site'
import SiteHeader from '../../_components/SiteHeader'
import SiteFooter from '../../_components/SiteFooter'
import DataTable from '../../_components/DataTable'
import Panel from '../../_components/Panel'
import PrimaryActionLink from '../../_components/PrimaryActionLink'
import RuleSourcePanel from '../../_components/RuleSourcePanel'
import MoneyText, { MoneyRange, SideRuleText } from '../../_components/MoneyText'
import { formatDateOnly } from '../../_lib/date'
import styles from '../CityPages.module.css'

type CityPageProps = { params: Promise<{ city: string }> }

export async function generateStaticParams() {
  const rules = await getAvailableCityRules()
  return Object.keys(rules).map((city) => ({ city }))
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city } = await params
  const rule = await getAvailableCityRule(city)
  return rule ? { title: `${rule.label}个税计算器｜${currentYear}年工资税后与五险一金｜${siteName}`, description: `按${rule.label}${currentYear}年社保公积金规则，测算工资到手、五险一金和全年预扣个税变化。`, alternates: { canonical: `/city/${city}` } } : { title: `城市个税计算器｜${siteName}` }
}

export default async function CityPage({ params }: CityPageProps) {
  const { city } = await params
  const rules = await getAvailableCityRules()
  const rule = rules[city]
  if (!rule) return <main className={styles.page}><h1>暂未收录这个城市</h1><p>请返回选择其他城市，或直接使用通用工资薪金计算器。</p><PrimaryActionLink href="/calculator">打开计算器 <ArrowRight size={16} /></PrimaryActionLink></main>
  const exampleSalary = 20000
  const socialBaseRule = getContributionBaseRule(rule, 'social')
  const housingBaseRule = getContributionBaseRule(rule, 'housingFund')
  const cityHousingRateOptions = getHousingRateOptions(rule)
  const defaultHousingRate = cityHousingRateOptions[cityHousingRateOptions.length - 1] || 12
  const exampleInsurance = calculateInsurance(rule, Math.min(Math.max(exampleSalary, socialBaseRule.min), socialBaseRule.max), Math.min(Math.max(exampleSalary, housingBaseRule.min), housingBaseRule.max), defaultHousingRate, defaultHousingRate)
  const exampleResult = calculateMonth(exampleSalary, 8, 1, 0, exampleInsurance)
  const ruleSourceDate = rule.sources.find((source) => source.checkedAt)?.checkedAt || rule.effective
  const ruleSourceLinks = rule.sources
    .filter((source): source is typeof source & { url: string } => Boolean(source.url))
    .map((source) => ({ label: source.title, url: source.url }))
  const contributionRows = rule.contributionItems.map((item) => ({
    key: item.code,
    cells: {
      item: item.name,
      base: getContributionBaseRule(rule, item.baseType).label,
      employee: <SideRuleText rule={item.employee} />,
      employer: <SideRuleText rule={item.employer} />,
    },
  }))

  return <div className="app-shell"><SiteHeader active="calculator" /><main className={styles.page}>
    <nav className={styles.breadcrumb}><Link href="/">极简个税</Link><span>/</span><span>{rule.label}个税计算器</span></nav>
    <section className={styles.hero}><div><div className={styles.titleLine}><MapPin size={20} /><span>{rule.label} · {currentYear}年规则</span></div><h1>{rule.label}个税计算器</h1><p>按 {rule.label} {currentYear} 年社保、公积金规则，测算工资到手、个人缴费和全年预扣变化。</p><PrimaryActionLink href={`/calculator?city=${city}`}>开始计算 <ArrowRight size={16} /></PrimaryActionLink></div><div className={styles.status}><ShieldCheck size={20} /><div><span>当前规则生效</span><strong>{formatDateOnly(rule.effective)}</strong></div></div></section>
    <section className={styles.contentGrid}><article className={styles.card}><h2>{rule.label}缴费范围</h2><p>社保和公积金基数可以分别设置，工资超过城市范围时按上下限估算。</p><dl><div><dt>{socialBaseRule.label}</dt><dd><MoneyRange min={socialBaseRule.min} max={socialBaseRule.max} /></dd></div><div><dt>{housingBaseRule.label}</dt><dd><MoneyRange min={housingBaseRule.min} max={housingBaseRule.max} /></dd></div></dl></article><article className={styles.card}><h2>个人与单位比例</h2><p>以下比例用于计算器的默认估算，实际申报以单位和城市规则为准。</p><dl>{rule.contributionItems.filter((item) => item.systemType === 'social').slice(0, 3).map((item) => <div key={item.code}><dt>{item.name}</dt><dd><SideRuleText rule={item.employee} /> / <SideRuleText rule={item.employer} /></dd></div>)}<div><dt>公积金</dt><dd>个人和单位可选 {Math.min(...cityHousingRateOptions)}% - {Math.max(...cityHousingRateOptions)}%</dd></div></dl></article></section>
    <Panel as="section" className={styles.policyTablePanel}>
      <div className={styles.tableHeading}>
        <div><h2>{rule.label}五险一金比例表</h2><p>完整列出当前计算器使用的个人和单位缴费规则。</p></div>
        <span>{currentYear} 年</span>
      </div>
      <DataTable
        ariaLabel={`${rule.label}五险一金比例表`}
        columns={[
          { key: 'item', header: '缴费项目' },
          { key: 'base', header: '使用基数' },
          { key: 'employee', header: '个人缴纳' },
          { key: 'employer', header: '单位缴纳' },
        ]}
        rows={contributionRows}
        wrapperClassName={styles.policyTableWrap}
        tableClassName={styles.policyTable}
      />
      <p className={styles.tableNote}>公积金比例在计算器中可选 {Math.min(...cityHousingRateOptions)}% - {Math.max(...cityHousingRateOptions)}%，实际缴纳以单位申报和城市规则为准。</p>
    </Panel>
    <Panel as="section" className={styles.exampleCard}>
      <div>
        <span className={styles.exampleLabel}>{rule.label}工资案例</span>
        <h2>税前 <MoneyText value={exampleSalary} />，8 月预计到手 <MoneyText value={exampleResult.takeHome} /></h2>
        <p>按当前默认规则估算，个人五险一金约 <MoneyText value={exampleResult.employeeInsurance} />，本月预扣个税约 <MoneyText value={exampleResult.currentTax} />。实际结果还会受专项附加扣除、入职月份和单位申报基数影响。</p>
      </div>
      <Link href={`/calculator?city=${city}&salary=${exampleSalary}&month=8&startMonth=1`}>按此案例计算 <ArrowRight size={16} /></Link>
    </Panel>
    <section className={styles.faqSection}>
      <h2>{rule.label}工资个税常见问题</h2>
      <div className={styles.faqList}>
        <details open><summary>{rule.label}社保和公积金基数可以不一样吗？</summary><p>可以分别设置。很多单位的社保基数、公积金基数和当月工资并不完全一致，计算器支持手动覆盖，并提示当前城市允许范围。</p></details>
        <details><summary>工资超过缴费基数上限时怎么计算？</summary><p>默认按城市规则上限估算缴费基数；如果单位实际申报口径不同，可以在工资计算器里点击编辑后手动填写。</p></details>
        <details><summary>{rule.label}页面的结果能直接作为申报依据吗？</summary><p>不能。页面用于快速测算和核对工资条，最终仍以个税 APP、扣缴单位和税务机关口径为准。</p></details>
      </div>
    </section>
    <section className={styles.nextStep}><div><Calculator size={20} /><div><h2>想知道自己的到手工资？</h2><p>输入税前月薪，查看本月个税、五险一金和全年预扣逐月明细。</p></div></div><Link href={`/calculator?city=${city}`}>进入工资计算器 <ArrowRight size={16} /></Link></section>
    <RuleSourcePanel
      title={`${rule.label}规则说明`}
      description="城市社保、公积金规则会随年度和地方口径调整，页面结果仅供测算，最终以个税 APP、扣缴单位或税务机关口径为准。"
      checkedAt={ruleSourceDate}
      links={ruleSourceLinks}
    />
    <SiteFooter />
  </main></div>
}
