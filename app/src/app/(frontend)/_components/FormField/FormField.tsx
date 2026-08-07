import type { ReactNode } from 'react'
import styles from './FormField.module.css'

type FormFieldProps = {
  action?: ReactNode
  children: ReactNode
  className?: string
  error?: ReactNode
  htmlFor?: string
  label: ReactNode
  meta?: ReactNode
}

export default function FormField({ action, children, className, error, htmlFor, label, meta }: FormFieldProps) {
  return <div className={[styles.field, className].filter(Boolean).join(' ')}><div className={styles.labelRow}><label htmlFor={htmlFor}>{label}</label>{action}</div>{children}{meta && <p className={styles.meta}>{meta}</p>}{error && <p className={styles.error}>{error}</p>}</div>
}
