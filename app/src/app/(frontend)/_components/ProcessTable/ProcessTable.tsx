import type { ReactNode } from 'react'
import DataTable, { type DataTableColumn, type DataTableRow } from '../DataTable'
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
  const columns: DataTableColumn[] = [
    { key: 'label', header: '项目', align: 'left', width: '34%' },
    { key: 'value', header: '计算', align: 'left' },
  ]

  return (
    <section className={classNames}>
      <div className={styles.heading}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className={styles.grid}>
        {groups.map((group, index) => {
          const rows: DataTableRow[] = group.rows.map((row, rowIndex) => ({
            key: rowIndex,
            cells: {
              label: { content: row.label, tone: 'muted' },
              value: { content: row.value, tone: 'strong' },
            },
          }))

          return (
            <section className={styles.section} key={index}>
              <h3>{group.title}</h3>
              <DataTable
                ariaLabel={`${title} - ${group.title}`}
                columns={columns}
                rows={rows}
                tableClassName={styles.table}
                wrapperClassName={styles.tableWrap}
              />
            </section>
          )
        })}
      </div>
    </section>
  )
}
