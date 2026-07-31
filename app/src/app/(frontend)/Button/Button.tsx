import Link, { type LinkProps } from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
}

type ButtonLinkProps = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
  children: ReactNode
  variant?: ButtonVariant
}

function buttonClassName(variant: ButtonVariant, className?: string) {
  return [styles.button, styles[variant], className].filter(Boolean).join(' ')
}

export function Button({ children, className, variant = 'primary', ...props }: ButtonProps) {
  return <button className={buttonClassName(variant, className)} {...props}>{children}</button>
}

export function ButtonLink({ children, className, variant = 'primary', ...props }: ButtonLinkProps) {
  return <Link className={buttonClassName(variant, className)} {...props}>{children}</Link>
}
