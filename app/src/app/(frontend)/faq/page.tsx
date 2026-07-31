import type { Metadata } from 'next'
import ToolContentPage from '../_components/ToolContentPage'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `工资个税常见问题｜${currentYear}年｜${siteName}`,
  description: `集中解答工资个税、累计预扣、社保公积金基数、专项附加扣除和年度汇算等常见问题。`,
  alternates: { canonical: '/faq' },
}

export default function FaqPage() {
  return <ToolContentPage eyebrow="工资个税常见问题" title="关于工资个税，你可能还想知道" description="把工资条上的税前工资、五险一金、累计预扣和到手工资之间的关系讲清楚。" action={{ href: '/calculator', label: '开始计算' }} sections={[
    { title: '为什么工资一样，每个月个税不一样？', description: '工资薪金通常采用累计预扣法。累计收入、累计扣除和已预扣税额会随着月份变化，因此本月税额不一定固定。' },
    { title: '社保缴费基数可以和工资不一样吗？', description: '可以。不同城市和单位可能有不同申报基数，但通常需要在对应城市政策允许范围内。' },
    { title: '全年个税和年度汇算是一回事吗？', description: '不是。全年个税通常指全年预扣合计估算，年度汇算最终结果还会受到综合所得、专项扣除和其他收入等因素影响。' },
    { title: '计算结果和工资条不一致怎么办？', description: '请检查缴费城市、入职月份、社保公积金基数、比例、奖金和专项附加扣除。计算器结果仅供测算，最终以扣缴单位和税务机关口径为准。' },
  ]} active="faq" />
}
