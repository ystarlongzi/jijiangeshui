import type { Metadata } from 'next'
import ToolContentPage from '../ToolContentPage'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `税后反推税前工资｜${currentYear}年个税计算｜${siteName}`,
  description: `输入期望到手工资，结合城市社保公积金和专项扣除，反推所需税前月薪。`,
  alternates: { canonical: '/reverse-tax' },
}

export default function ReverseTaxPage() {
  return <ToolContentPage eyebrow={`${currentYear} 年工资工具`} title="税后工资怎么反推？" description="从期望到手工资出发，反推需要的税前收入，并同步考虑社保、公积金和个人所得税。" action={{ href: '/calculator#reverse', label: '进入工资计算器' }} sections={[
    { title: '适合哪些场景？', description: '谈薪、换工作、核对 offer 或制定年度收入目标时，可以先确定期望到手工资，再估算对应的税前月薪。' },
    { title: '反推会考虑什么？', description: '税前工资不是简单加上固定税率，还会受到缴费城市、社保公积金基数、住房公积金比例、专项附加扣除和累计预扣的影响。' },
    { title: '结果如何使用？', description: '反推结果适合用于谈薪和预算估算，实际工资条还可能受到奖金、补发工资、单位缴费口径等因素影响。' },
  ]} active="reverse-tax" />
}
