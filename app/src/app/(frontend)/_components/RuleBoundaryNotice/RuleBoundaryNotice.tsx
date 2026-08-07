import { AlertTriangle } from 'lucide-react'
import styles from './RuleBoundaryNotice.module.css'

type RuleBoundaryNoticeProps = {
  messages: string[]
  title: string
  tone?: 'warning' | 'error'
}

export default function RuleBoundaryNotice({ messages, title, tone = 'warning' }: RuleBoundaryNoticeProps) {
  if (messages.length === 0) return null

  return <div className={`${styles.notice} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
    <AlertTriangle aria-hidden="true" size={16} strokeWidth={2} />
    <div>
      <strong>{title}</strong>
      <ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul>
    </div>
  </div>
}
