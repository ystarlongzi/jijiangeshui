import type { FormHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import styles from './Panel.module.css'

type PanelTag = 'article' | 'aside' | 'div' | 'form' | 'main' | 'section'

type PanelProps = {
  as?: PanelTag
  children: ReactNode
  className?: string
} & HTMLAttributes<HTMLElement> & FormHTMLAttributes<HTMLFormElement>

export default function Panel({ as: Tag = 'div', children, className, ...props }: PanelProps) {
  return <Tag className={[styles.panel, className].filter(Boolean).join(' ')} {...props}>{children}</Tag>
}
