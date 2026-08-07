import type { ReactNode } from 'react'
import styles from './SelectField.module.css'

type SelectValue = string | number

type SelectOption<T extends SelectValue> = {
  label: ReactNode
  value: T
}

type SelectFieldProps<T extends SelectValue> = {
  id?: string
  label: ReactNode
  value: T
  options: SelectOption<T>[]
  action?: ReactNode
  className?: string
  invalid?: boolean
  onChange: (value: T) => void
}

export default function SelectField<T extends SelectValue>({
  action,
  className,
  id,
  invalid = false,
  label,
  onChange,
  options,
  value,
}: SelectFieldProps<T>) {
  const fieldClassName = [styles.field, className].filter(Boolean).join(' ')
  const controlClassName = [styles.control, invalid ? styles.invalid : ''].filter(Boolean).join(' ')

  return <div className={fieldClassName}><div className={styles.labelRow}><label htmlFor={id}>{label}</label>{action}</div><div className={controlClassName}><select id={id} value={String(value)} onChange={(event) => {
    const next = options.find((option) => String(option.value) === event.target.value)
    if (next) onChange(next.value)
  }}>{options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select></div></div>
}
