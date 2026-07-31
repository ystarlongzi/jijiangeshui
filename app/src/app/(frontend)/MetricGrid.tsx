import type { ReactNode } from 'react'

type MetricItem = {
  label: ReactNode
  value: ReactNode
}

type MetricGridProps = {
  items: MetricItem[]
  className?: string
}

export default function MetricGrid({ items, className }: MetricGridProps) {
  const gridClassName = ['reverse-metrics', className].filter(Boolean).join(' ')
  return <div className={gridClassName}>{items.map((item, index) => <div key={index}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
}
