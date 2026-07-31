import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Calculator, MapPin, ShieldCheck } from 'lucide-react'
import { cityRules } from '@/lib/tax-rules'
import { calculateInsurance, calculateMonth } from '@/lib/tax-calculator'
import { currentYear, siteName } from '@/lib/site'
import SiteHeader from '../../SiteHeader'
import SiteFooter from '../../SiteFooter'
import RuleSourcePanel from '../../RuleSourcePanel'
import styles from '../CityPages.module.css'

type CityPageProps = { params: Promise<{ city: string }> }

export function generateStaticParams() {
  return Object.keys(cityRules).map((city) => ({ city }))
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city } = await params
  const rule = cityRules[city]
  return rule ? { title: `${rule.label}个税计算器｜${currentYear}年工资税后与五险一金｜${siteName}`, description: `按${rule.label}${currentYear}年社保公积金规则，测算工资到手、五险一金和全年预扣个税变化。`, alternates: { canonical: `/city/${city}` } } : { title: `城市个税计算器｜${siteName}` }
}

export default async function CityPage({ params }: CityPageProps) {
  const { city } = await params
  const rule = cityRules[city]
  if (!rule) return <main className={styles.page}><h1>暂未收录这个城市</h1><p>请返回选择其他城市，或直接使用通用工资薪金计算器。</p><Link className="home-primary-action" href="/calculator">打开计算器 <ArrowRight size={16} /></Link></main>
  const exampleSalary = 20000
  const exampleInsurance = calculateInsurance(rule, Math.min(Math.max(exampleSalary, rule.socialMin), rule.socialMax), Math.min(Math.max(exampleSalary, rule.housingMin), rule.housingMax), 12, 12)
  const exampleResult = calculateMonth(exampleSalary, 8, 1, 0, exampleInsurance)

  return <div className="app-shell"><SiteHeader active="calculator" /><main className={styles.page}>
    <nav className={styles.breadcrumb}><Link href="/">极简个税</Link><span>/</span><span>{rule.label}个税计算器</span></nav>
    <section className={styles.hero}><div><div className={styles.titleLine}><MapPin size={20} /><span>{rule.label} · {currentYear}年规则</span></div><h1>{rule.label}个税计算器</h1><p>按 {rule.label} {currentYear} 年社保、公积金规则，测算工资到手、个人缴费和全年预扣变化。</p><Link className="home-primary-action" href={`/calculator?city=${city}`}>开始计算 <ArrowRight size={16} /></Link></div><div className={styles.status}><ShieldCheck size={20} /><span>当前规则生效</span><strong>{rule.effective}</strong></div></section>
    <section className={styles.contentGrid}><article className={styles.card}><h2>{rule.label}缴费范围</h2><p>社保和公积金基数可以分别设置，工资超过城市范围时按上下限估算。</p><dl><div><dt>社保缴费基数</dt><dd>{formatMoney(rule.socialMin)} - {formatMoney(rule.socialMax)}</dd></div><div><dt>公积金缴费基数</dt><dd>{formatMoney(rule.housingMin)} - {formatMoney(rule.housingMax)}</dd></div></dl></article><article className={styles.card}><h2>个人与单位比例</h2><p>以下比例用于计算器的默认估算，实际申报以单位和城市规则为准。</p><dl><div><dt>养老保险</dt><dd>个人 {rule.socialEmployee}% / 单位 {rule.socialEmployer}%</dd></div><div><dt>医疗保险</dt><dd>个人 {rule.medicalEmployee}% / 单位 {rule.medicalEmployer}%</dd></div><div><dt>公积金</dt><dd>个人和单位可在计算器中分别选择</dd></div></dl></article></section>
    <section className={`${styles.exampleCard} panel`}>
      <div>
        <span>{rule.label}工资案例</span>
        <h2>税前 {formatMoney(exampleSalary)}，8 月预计到手 {formatMoney(exampleResult.takeHome)}</h2>
        <p>按当前默认规则估算，个人五险一金约 {formatMoney(exampleResult.employeeInsurance)}，本月预扣个税约 {formatMoney(exampleResult.currentTax)}。实际结果还会受专项附加扣除、入职月份和单位申报基数影响。</p>
      </div>
      <Link href={`/calculator?city=${city}&salary=${exampleSalary}&month=8&startMonth=1`}>按此案例计算 <ArrowRight size={16} /></Link>
    </section>
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
      links={[]}
    />
    <SiteFooter />
  </main></div>
}

function formatMoney(value: number) {
  return `¥${value.toLocaleString('zh-CN')}`
}
