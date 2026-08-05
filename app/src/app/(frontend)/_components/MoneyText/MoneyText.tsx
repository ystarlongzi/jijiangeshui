'use client'

import type { ContributionSideRule } from '@/lib/tax-rules'
import { useMoneyFormat } from '../MoneyFormatProvider'

type MoneyTextProps = {
  value: number
  decimals?: number
  className?: string
}

export default function MoneyText({ value, decimals = 0, className }: MoneyTextProps) {
  const { money } = useMoneyFormat()
  return <span className={className}>{money(value, decimals)}</span>
}

export function MoneyRange({ min, max, decimals = 0, className }: { min: number; max: number; decimals?: number; className?: string }) {
  const { money } = useMoneyFormat()
  return <span className={className}>{money(min, decimals)} - {money(max, decimals)}</span>
}

export function SideRuleText({ rule }: { rule: ContributionSideRule }) {
  const { money } = useMoneyFormat()

  if (rule.method === 'none') return <>不缴</>
  if (rule.method === 'fixed') return <>{money(rule.fixedAmount || 0)}</>
  if (rule.method === 'rate') return <>{rule.rate || 0}%</>
  return <>{rule.rate || 0}% + {money(rule.fixedAmount || 0)}</>
}
