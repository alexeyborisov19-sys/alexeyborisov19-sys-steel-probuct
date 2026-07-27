import Script from "next/script";

const yandexCounterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;

/**
 * Analytics remains completely inactive until the corresponding public IDs are
 * supplied in the deployment environment. This prevents accidental requests to
 * a third party during local development and before consent is configured.
 */
export function Analytics() {
  return <>
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

export function syncConsent() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const raw = window.localStorage.getItem("site_cookie_consent");
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return !!parsed?.analytics;
    } catch (e) {
      return false;
    }
  } catch (e) {
    // If reading storage fails (e.g. sandboxed environment), disable analytics
    return false;
  }
}
