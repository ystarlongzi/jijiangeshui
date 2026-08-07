export function formatDateOnly(value: string | null | undefined) {
  if (!value) return ''

  const dateOnly = /^\d{4}-\d{2}-\d{2}/.exec(value)
  if (dateOnly) return dateOnly[0]

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toISOString().slice(0, 10)
}
