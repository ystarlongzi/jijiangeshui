export type DigitGrouping = 'thousand' | 'wan'

type FormatMoneyOptions = {
  decimals?: number
  currency?: boolean
  grouping?: DigitGrouping
}

const groupInteger = (value: string, size: number) => {
  const groups: string[] = []
  for (let index = value.length; index > 0; index -= size) {
    groups.unshift(value.slice(Math.max(0, index - size), index))
  }
  return groups.join(',')
}

export function formatGroupedNumber(value: number, decimals = 0, grouping: DigitGrouping = 'thousand') {
  const fixed = Math.abs(value).toFixed(decimals)
  const [integer, fraction] = fixed.split('.')
  const grouped = groupInteger(integer, grouping === 'wan' ? 4 : 3)
  const sign = value < 0 ? '-' : ''
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`
}

export function formatMoney(value: number, options: FormatMoneyOptions = {}) {
  const { decimals = 0, currency = true, grouping = 'thousand' } = options
  return `${currency ? '¥' : ''}${formatGroupedNumber(value, decimals, grouping)}`
}
