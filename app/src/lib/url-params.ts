const maxAmount = 99999999

export function parseAmountParam(value: string | null) {
  if (!value) return 0
  const amount = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.min(maxAmount, Math.round(amount))
}

export function createDeductionHref(pathname: string, amount: number, hash = '') {
  const safeAmount = Math.min(maxAmount, Math.max(0, Math.round(amount)))
  const query = safeAmount > 0 ? `?deduction=${safeAmount}` : ''
  return `${pathname}${query}${hash}`
}
