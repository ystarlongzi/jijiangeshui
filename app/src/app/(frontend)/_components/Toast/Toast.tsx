import styles from './Toast.module.css'

type ToastProps = {
  message: string
}

export default function Toast({ message }: ToastProps) {
  return <div className={[styles.toast, message ? styles.visible : ''].filter(Boolean).join(' ')} role="status" aria-live="polite">{message}</div>
}
