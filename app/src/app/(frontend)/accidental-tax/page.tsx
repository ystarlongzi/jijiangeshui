import type { Metadata } from 'next'
import AccidentalTaxClient from './AccidentalTaxClient'
import { currentYear, siteName, siteUrl } from '@/lib/site'
import JsonLd, { createCalculatorJsonLd } from '../_components/JsonLd'

export const metadata: Metadata = {
  title: `${currentYear}年偶然所得个税计算器｜中奖个税｜${siteName}`,
  description: `输入中奖、得奖等偶然所得收入，按 ${currentYear} 年个人所得税 20% 比例税率测算应缴个税和税后收入。`,
  alternates: { canonical: '/accidental-tax' },
}

export default function AccidentalTaxPage() {
  return <>
    <JsonLd data={createCalculatorJsonLd({ name: `${currentYear}年偶然所得个税计算器`, description: metadata.description, url: `${siteUrl}/accidental-tax`, siteName })} />
    <AccidentalTaxClient />
  </>
}
