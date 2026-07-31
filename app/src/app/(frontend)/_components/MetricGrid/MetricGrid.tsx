import type { ReactNode } from 'react'
import styles from './MetricGrid.module.css'

type MetricItem = {
  label: ReactNode
  value: ReactNode
}

type MetricGridProps = {
  items: MetricItem[]
  className?: string
}

export default function MetricGrid({ items, className }: MetricGridProps) {
  const gridClassName = [styles.grid, className].filter(Boolean).join(' ')
  return <div className={gridClassName}>
    {items.map((item, index) => <div className={styles.item} key={index}>
      <span className={styles.label}>{item.label}</span>
      <strong className={styles.value}>{item.value}</strong>
    </div>)}
  </div>
}
