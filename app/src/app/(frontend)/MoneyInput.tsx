import type { ChangeEvent, FocusEvent, ReactNode } from 'react'

const defaultMax = 99999999
const rankTips: Record<number, string> = {
  5: '万',
  6: '十万',
  7: '百万',
  8: '千万',
}

type MoneyInputProps = {
  id?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  readOnly?: boolean
  className?: string
  prefix?: ReactNode
  unit?: ReactNode
}

export default function MoneyInput({
  id,
  value,
  onChange,
  min = 0,
  max = defaultMax,
  step = 100,
  readOnly = false,
  className = '',
  prefix = '¥',
  unit = '元',
}: MoneyInputProps) {
  const digits = String(Math.trunc(Math.abs(value || 0)))
  const tip = rankTips[digits.length]

  const updateValue = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value) || 0
    onChange(Math.min(Math.max(nextValue, min), max))
  }

  const selectZero = (event: FocusEvent<HTMLInputElement>) => {
    if (!readOnly && Number(event.target.value) === 0) event.target.select()
  }

  return <div className={`money-input amount-input${readOnly ? ' is-readonly' : ''}${className ? ` ${className}` : ''}`}>
    <span>{prefix}</span>
    <span className="amount-input-box">
      <input id={id} type="number" min={min} max={max} step={step} value={value} readOnly={readOnly} onFocus={selectZero} onChange={updateValue} inputMode="decimal" />
      {tip && <span className="amount-tip-track" aria-hidden="true"><span className="amount-tip-digits"><span className="amount-rank-tip">{tip}</span>{digits}</span></span>}
    </span>
    <span className="unit">{unit}</span>
  </div>
}
