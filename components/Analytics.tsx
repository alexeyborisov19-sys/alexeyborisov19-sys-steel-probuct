import Script from "next/script";

const googleMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const yandexCounterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;

/**
 * Analytics remains completely inactive until the corresponding public IDs are
 * supplied in the deployment environment. This prevents accidental requests to
 * a third party during local development and before consent is configured.
 */
export function Analytics() {
  return <>
    {googleMeasurementId ? <>
      <Script async src={`https://www.googletagmanager.com/gtag/js?id=${googleMeasurementId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${googleMeasurementId}', { anonymize_ip: true });
      `}</Script>
    </> : null}
    {yandexCounterId ? <Script id="yandex-metrica" strategy="afterInteractive">{`
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
      })(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
      ym(${Number(yandexCounterId)}, 'init', {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
      });
    `}</Script> : null}
  </>;
}
