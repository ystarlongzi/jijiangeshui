import { ruleCheckedDate } from '@/lib/site'
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
  title = '规则来源',
  description = '计算口径参考国家税务总局公开规则，政策变化后需要更新规则版本和核对日期。',
  checkedAt = ruleCheckedDate,
  sourceLabel = '查看国家税务总局规则',
  sourceUrl = 'https://fgk.chinatax.gov.cn/zcfgk/c100012/c5194838/content.html',
  links,
}: RuleSourcePanelProps) {
  const sourceLinks = links || [{ label: sourceLabel, url: sourceUrl }]

  return <section className={styles.section} aria-label="官方来源">
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      <p className={styles.date}>规则核对日期：{checkedAt}</p>
    </div>
    <div className={styles.links}>
      {sourceLinks.length > 0 ? sourceLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>) : <span>暂无来源链接</span>}
    </div>
  </section>
}
