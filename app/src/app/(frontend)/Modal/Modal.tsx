'use client'

import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './Modal.module.css'

type ModalProps = {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

export default function Modal({ open, title, description, children, footer, onClose }: ModalProps) {
  const titleId = useId()

  if (!open) return null

  return <div className={styles.backdrop} role="presentation" onClick={onClose}>
    <section className={`${styles.panel} panel`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
      <div className={styles.heading}>
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      {children}
      {footer}
    </section>
  </div>
}
