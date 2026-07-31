import type { ReactNode } from 'react'

type DataTableColumn = {
  key: string
  header: ReactNode
  className?: string
}

type DataTableRow = {
  key: string | number
  className?: string
  cells: Record<string, ReactNode>
}

type DataTableProps = {
  columns: DataTableColumn[]
  rows: DataTableRow[]
  wrapperClassName?: string
  tableClassName?: string
}

export default function DataTable({ columns, rows, wrapperClassName, tableClassName }: DataTableProps) {
  const wrapClassName = ['data-table-wrap', wrapperClassName].filter(Boolean).join(' ')
  return <div className={wrapClassName}><table className={tableClassName}><thead><tr>{columns.map((column) => <th className={column.className} key={column.key}>{column.header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className={row.className} key={row.key}>{columns.map((column) => <td className={column.className} key={column.key}>{row.cells[column.key]}</td>)}</tr>)}</tbody></table></div>
}
