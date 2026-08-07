import Script from 'next/script'

export default function AnalyticsScripts() {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const validGaMeasurementId = /^G-[A-Z0-9]+$/iu.test(gaMeasurementId || '') ? gaMeasurementId : null
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN

  return <>
    {validGaMeasurementId && <>
      <Script id="google-analytics-init" strategy="beforeInteractive">
        {`window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
window.gtag('js', new Date());
window.gtag('config', ${JSON.stringify(validGaMeasurementId)}, { send_page_view: false });`}
      </Script>
      <Script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(validGaMeasurementId)}`} strategy="afterInteractive" />
    </>}
    {plausibleDomain && <Script src="https://plausible.io/js/script.js" data-domain={plausibleDomain} strategy="afterInteractive" />}
  </>
}
