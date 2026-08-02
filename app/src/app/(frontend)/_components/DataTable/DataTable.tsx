import type { ReactNode } from 'react'
import styles from './DataTable.module.css'

export type DataTableColumn = {
  key: string
  header: ReactNode
  className?: string
}

export type DataTableRow = {
  key: string | number
  className?: string
  cells: Record<string, ReactNode>
}

type DataTableProps = {
  columns: DataTableColumn[]
  rows: DataTableRow[]
  ariaLabel?: string
  emptyText?: ReactNode
  wrapperClassName?: string
  tableClassName?: string
}

export default function DataTable({
  columns,
  rows,
  ariaLabel,
  emptyText = '暂无数据',
  wrapperClassName,
  tableClassName,
}: DataTableProps) {
  const wrapClassName = [styles.wrap, wrapperClassName].filter(Boolean).join(' ')
  const resolvedTableClassName = [styles.table, tableClassName].filter(Boolean).join(' ')

  return (
    <div className={wrapClassName}>
      <table className={resolvedTableClassName} aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.className} key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
            <tr className={row.className} key={row.key}>
              {columns.map((column) => (
                <td className={column.className} key={column.key}>
                  {row.cells[column.key]}
                </td>
              ))}
            </tr>
          )) : (
            <tr className={styles.emptyRow}>
              <td colSpan={columns.length}>{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
