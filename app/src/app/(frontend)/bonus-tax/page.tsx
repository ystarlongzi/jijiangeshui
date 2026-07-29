import type { Metadata } from 'next'
import ToolContentPage from '../ToolContentPage'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `年终奖个税计算与单独计税｜${currentYear}年｜${siteName}`,
  description: `了解年终奖单独计税与并入综合所得的区别，判断不同计税方式对到手收入的影响。`,
  alternates: { canonical: '/bonus-tax' },
}

export default function BonusTaxPage() {
  return <ToolContentPage eyebrow={`${currentYear} 年年终奖规则`} title="年终奖个税怎么算？" description="对比年终奖单独计税与并入综合所得，了解不同计税方式对最终到手金额的影响。" action={{ href: '/calculator#bonus', label: '开始计算' }} sections={[
    { title: '两种计税方式', description: '符合条件的居民个人取得全年一次性奖金，可以选择单独计税，也可以选择并入当年综合所得计算。' },
    { title: '为什么需要比较？', description: '年终奖金额、全年工资和累计应纳税所得额不同，适合的计税方式也可能不同。不能只看奖金金额判断。' },
    { title: '计算前需要准备什么？', description: '准备全年工资、年终奖金额、社保公积金和专项附加扣除等信息，再分别测算两种方式的税后结果。', items: ['年终奖税前金额', '全年工资和入职月份', '社保公积金缴费基数', '专项附加扣除项目'] },
  ]} />
}
