'use client'

export type AnalyticsEventName =
  | 'page_view'
  | 'calculate_complete'
  | 'result_expand'
  | 'share_link'
  | 'copy_result'
  | 'export_csv'
  | 'link_click'
  | 'money_grouping_change'
  | 'mobile_menu_toggle'
  | 'tax_rate_tab_change'
  | 'deduction_selector_open'
  | 'deduction_selector_group_toggle'
  | 'deduction_selector_option_toggle'
  | 'deduction_selector_clear'
  | 'deduction_selector_save'
export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

type TrackedEvent = {
  name: AnalyticsEventName
  path: string
  payload: AnalyticsPayload
  timestamp: string
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    plausible?: (eventName: string, options?: { props?: AnalyticsPayload }) => void
  }
}

export function trackEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return

  const detail: TrackedEvent = {
    name,
    path: window.location.pathname,
    payload,
    timestamp: new Date().toISOString(),
  }

  window.dispatchEvent(new CustomEvent('jijian-geshui:analytics', { detail }))
  window.dataLayer?.push({ event: `jijian_${name}`, ...payload, path: detail.path })
  window.plausible?.(`jijian_${name}`, { props: { ...payload, path: detail.path } })
}
