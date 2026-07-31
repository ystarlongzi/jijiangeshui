import Script from 'next/script'

export default function AnalyticsScripts() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

  return <>
    {gtmId && <Script id="gtm-init" strategy="afterInteractive">
      {`window.dataLayer = window.dataLayer || []; window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });`}
    </Script>}
    {gtmId && <Script src={`https://www.googletagmanager.com/gtm.js?id=${gtmId}`} strategy="afterInteractive" />}
    {plausibleDomain && <Script src="https://plausible.io/js/script.js" data-domain={plausibleDomain} strategy="afterInteractive" />}
  </>
}
