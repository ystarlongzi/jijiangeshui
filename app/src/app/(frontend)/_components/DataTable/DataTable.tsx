import type { ReactNode } from 'react'
import styles from './DataTable.module.css'

export type DataTableColumn = {
  key: string
  header: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  width?: string
}

export type DataTableCell = ReactNode | {
  content: ReactNode
  className?: string
  title?: string
}

export type DataTableRow = {
  key: string | number
  className?: string
  tone?: 'highlight' | 'subtotal' | 'muted'
  cells: Record<string, DataTableCell>
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
              <th className={getColumnClassName(column)} key={column.key} scope="col" style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
            <tr className={row.className} data-tone={row.tone} key={row.key}>
              {columns.map((column) => {
                const cell = normalizeCell(row.cells[column.key])
                return (
                  <td className={[getColumnClassName(column), cell.className].filter(Boolean).join(' ')} key={column.key} title={cell.title}>
                    {cell.content}
                  </td>
                )
              })}
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

function normalizeCell(cell: DataTableCell | undefined) {
  if (cell && typeof cell === 'object' && 'content' in cell) return cell
  return { content: cell ?? null }
}

function getColumnClassName(column: DataTableColumn) {
  return [
    column.align ? styles[`align-${column.align}`] : '',
    column.className,
  ].filter(Boolean).join(' ')
}
