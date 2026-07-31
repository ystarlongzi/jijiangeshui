'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '../_lib/analytics'

export default function AnalyticsReporter() {
  const pathname = usePathname()

  useEffect(() => {
    trackEvent('page_view')
  }, [pathname])

  return null
}
