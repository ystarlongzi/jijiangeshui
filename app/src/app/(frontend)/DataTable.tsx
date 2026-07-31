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
  return <div className={wrapperClassName}><table className={tableClassName}><thead><tr>{columns.map((column) => <th className={column.className} key={column.key}>{column.header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className={row.className} key={row.key}>{columns.map((column) => <td className={column.className} key={column.key}>{row.cells[column.key]}</td>)}</tr>)}</tbody></table></div>
}
