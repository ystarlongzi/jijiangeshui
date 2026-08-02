import { ruleCheckedDate } from '@/lib/site'
import { formatDateOnly } from '../../_lib/date'
import styles from './RuleSourcePanel.module.css'

type RuleSourcePanelProps = {
  title?: string
  description?: string
  checkedAt?: string
  sourceLabel?: string
  sourceUrl?: string
  links?: { label: string; url: string }[]
}

export default function RuleSourcePanel({
  title = '官方依据',
  description = '计算口径参考国家税务总局公开规则，政策变化后会更新规则版本和核对日期。',
  checkedAt = ruleCheckedDate,
  sourceLabel = '查看国家税务总局规则',
  sourceUrl = 'https://fgk.chinatax.gov.cn/zcfgk/c100012/c5194838/content.html',
  links,
}: RuleSourcePanelProps) {
  const defaultSourceLinks = [{ label: sourceLabel, url: sourceUrl }]
  const visibleLinks = (links || defaultSourceLinks).filter((link) => !isThirdPartyRuleLink(link))
  const sourceLinks = visibleLinks.length > 0 ? visibleLinks : defaultSourceLinks
  const displayCheckedAt = formatDateOnly(checkedAt)

  return <section className={styles.section} aria-label="官方依据">
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      <p className={styles.date}>规则核对日期：{displayCheckedAt}</p>
    </div>
    <div className={styles.links}>
      {sourceLinks.length > 0 ? sourceLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>) : <span>暂无来源链接</span>}
    </div>
  </section>
}

function isThirdPartyRuleLink(link: { label: string; url: string }) {
  const label = link.label.toLowerCase()
  const url = link.url.toLowerCase()
  return label.includes('hrwork') || label.includes('第三方') || url.includes('hrwork')
}
