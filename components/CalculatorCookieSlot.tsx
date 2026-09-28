import { CookieConsent } from "@/components/CookieConsent";

// Presentation only: no storage writes and no analytics authorization. The notice
// is server-rendered at its real height. A valid saved choice hides it before paint,
// preventing both the first-visit insertion and returning-visitor collapse.
const restorePresentation = `(function(){try{var v=JSON.parse(localStorage.getItem('steelprodukt-cookie-consent-v2')||'null');if(v&&v.version===2&&v.necessary===true&&typeof v.analytics==='boolean'){document.getElementById('calculator-cookie-slot').setAttribute('data-cookie-stored','true');}}catch(e){}})();`;

export function CalculatorCookieSlot({ className = "" }: { className?: string }) {
  return <div id="calculator-cookie-slot" className={className} suppressHydrationWarning>
    <script dangerouslySetInnerHTML={{ __html: restorePresentation }} />
    <CookieConsent inline />
  </div>;
}
