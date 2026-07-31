import type { ReactNode } from 'react'
import styles from './SectionHeading.module.css'

type SectionHeadingProps = {
  action?: ReactNode
  className?: string
  description?: string
  descriptionPlacement?: 'aside' | 'below'
  title: string
  titleId?: string
}

export default function SectionHeading({
  action,
  className,
  description,
  descriptionPlacement = action ? 'below' : 'aside',
  title,
  titleId,
}: SectionHeadingProps) {
  const descriptionNode = description ? <p>{description}</p> : null

  return <div className={[styles.heading, className].filter(Boolean).join(' ')}>
    <div className={styles.titleBlock}>
      <h2 id={titleId}>{title}</h2>
      {descriptionPlacement === 'below' ? descriptionNode : null}
    </div>
    {action ? <div className={styles.action}>{action}</div> : descriptionPlacement === 'aside' ? descriptionNode : null}
  </div>
}
