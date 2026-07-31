'use client'

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import type { LinkProps } from 'next/link'
import TrackedLink from '../TrackedLink'
import type { AnalyticsPayload } from '../../_lib/analytics'
import styles from './PrimaryActionLink.module.css'

type PrimaryActionLinkProps = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
  children: ReactNode
  eventPayload?: AnalyticsPayload
}

export default function PrimaryActionLink({ children, className, ...props }: PrimaryActionLinkProps) {
  return <TrackedLink className={[styles.link, className].filter(Boolean).join(' ')} {...props}>{children}</TrackedLink>
}
