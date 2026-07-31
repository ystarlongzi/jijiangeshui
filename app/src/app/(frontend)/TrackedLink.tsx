'use client'

import Link, { type LinkProps } from 'next/link'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { trackEvent, type AnalyticsPayload } from './analytics'

type TrackedLinkProps = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
  eventPayload?: AnalyticsPayload
  children: ReactNode
}

export default function TrackedLink({ children, eventPayload, href, onClick, ...props }: TrackedLinkProps) {
  return <Link
    {...props}
    href={href}
    onClick={(event) => {
      trackEvent('link_click', {
        href: typeof href === 'string' ? href : href.pathname || '',
        ...eventPayload,
      })
      onClick?.(event)
    }}
  >
    {children}
  </Link>
}
