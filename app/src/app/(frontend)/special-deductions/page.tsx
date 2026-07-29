import type { Metadata } from 'next'
import ToolContentPage from '../ToolContentPage'
import { deductionOptions } from '@/lib/tax-rules'
import { currentYear, siteName } from '@/lib/site'

export const metadata: Metadata = {
  title: `专项附加扣除标准与个税影响｜${currentYear}年｜${siteName}`,
  description: `查看子女教育、婴幼儿照护、住房租金和赡养老人等专项附加扣除项目及每月扣除标准。`,
  alternates: { canonical: '/special-deductions' },
}

export default function SpecialDeductionsPage() {
  return <ToolContentPage eyebrow={`${currentYear} 年专项附加扣除`} title="哪些支出可以扣个税？" description="专项附加扣除会降低工资薪金的应纳税所得额，进而影响每月预扣个税和全年到手工资。" action={{ href: '/calculator#deduction', label: '带入工资计算器' }} sections={[
    { title: '常见扣除项目', description: '以下是计算器当前支持的专项附加扣除项目和月度估算金额。具体享受条件及分摊方式以官方规定为准。', items: deductionOptions.map((item) => `${item.label}：${item.amount.toLocaleString('zh-CN')} 元 / 月`) },
    { title: '扣除如何影响个税？', description: '专项附加扣除会减少累计应纳税所得额。实际节税金额取决于所在预扣率档位，并不等于扣除金额本身。' },
    { title: '使用时要注意什么？', description: '同一项目涉及多人分摊时，需要按实际情况填报；扣除资格、年度标准和申报方式发生变化时，应及时更新信息。' },
  ]} />
}
