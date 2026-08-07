import type { ChangeEvent, FocusEvent, ReactNode } from 'react'
import styles from './MoneyInput.module.css'

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

  const rootClassName = [
    styles.root,
    'money-input',
    'amount-input',
    readOnly ? 'is-readonly' : '',
    className,
  ].filter(Boolean).join(' ')

  return <div className={rootClassName}>
    <span>{prefix}</span>
    <span className={`${styles.box} amount-input-box`}>
      <input id={id} type="number" min={min} max={max} step={step} value={value} readOnly={readOnly} onFocus={selectZero} onChange={updateValue} inputMode="decimal" />
      {tip && <span className={`${styles.tipTrack} amount-tip-track`} aria-hidden="true"><span className={styles.tipDigits}><span className={styles.rankTip}>{tip}</span>{digits}</span></span>}
    </span>
    <span className={`${styles.unit} unit`}>{unit}</span>
  </div>
}
