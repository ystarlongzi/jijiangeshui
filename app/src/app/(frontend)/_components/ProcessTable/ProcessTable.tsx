import type { ReactNode } from 'react'
import styles from './ProcessTable.module.css'

export type ProcessTableGroup = {
  title: ReactNode
  rows: {
    label: ReactNode
    value: ReactNode
  }[]
}

type ProcessTableProps = {
  title: ReactNode
  description?: ReactNode
  groups: ProcessTableGroup[]
  className?: string
}

export default function ProcessTable({ title, description, groups, className }: ProcessTableProps) {
  const classNames = [styles.panel, className].filter(Boolean).join(' ')

  return <section className={classNames}><div className={styles.heading}><h2>{title}</h2>{description && <p>{description}</p>}</div>{groups.map((group, index) => <div className={styles.section} key={index}><h3>{group.title}</h3><dl>{group.rows.map((row, rowIndex) => <div key={rowIndex}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div>)}</section>
}
