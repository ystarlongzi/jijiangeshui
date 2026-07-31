import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import styles from './ResultActions.module.css'

type ResultActionsProps = {
  children: ReactNode
}

type ResultActionLinkProps = ComponentProps<typeof Link>

type ResultActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export default function ResultActions({ children }: ResultActionsProps) {
  return <div className={styles.actions}>{children}</div>
}

export function ResultActionLink({ children, className = '', ...props }: ResultActionLinkProps) {
  return <Link className={`${styles.link}${className ? ` ${className}` : ''}`} {...props}>{children}</Link>
}

export function ResultActionButton({ children, className = '', type = 'button', ...props }: ResultActionButtonProps) {
  return <button className={`${styles.button}${className ? ` ${className}` : ''}`} type={type} {...props}>{children}</button>
}

