import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { legalLinks, legalOperator } from "@/lib/legal";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Реквизиты ООО «ЭНЕРГОАЛЬЯНС» и контакты",
  description: "Юридические, банковские и контактные реквизиты ООО «ЭНЕРГОАЛЬЯНС» — владельца и оператора сайта бренда «Сталь Продукт».",
  path: legalLinks.requisites,
});

const rows = [
  ["Полное наименование", legalOperator.name],
  ["ОГРН", legalOperator.ogrn],
  ["ИНН / КПП", `${legalOperator.inn} / ${legalOperator.kpp}`],
  ["Генеральный директор", legalOperator.director],
  ["Юридический адрес", legalOperator.legalAddress],
  ["Адрес производства", legalOperator.productionAddress],
  ["Почтовый адрес", legalOperator.postalAddress],
  ["Расчётный счёт", legalOperator.bank.account],
  ["Банк", legalOperator.bank.bank],
  ["Корреспондентский счёт", legalOperator.bank.correspondentAccount],
  ["БИК", legalOperator.bank.bik],
  ["Телефон", legalOperator.phone],
  ["Контактный e-mail", legalOperator.email],
  ["Сайт", "https://www.steelprodukt.ru"],
];

export default function RequisitesPage() {
  return <LegalDocument path={legalLinks.requisites} title="Реквизиты" description="Реквизиты юридического лица — оператора сайта Сталь Продукт.">
    <p className="legal-document__date">Актуально на {legalOperator.policyVersion}</p>
    <p>{legalOperator.shortName} является владельцем сайта, рекламодателем размещаемых на нём собственных предложений и оператором персональных данных посетителей сайта.</p>
    <dl className="mt-7 divide-y divide-white/10 border-y border-white/10">
      {rows.map(([label, value]) => <div key={label} className="grid gap-1 py-4 sm:grid-cols-[210px_1fr] sm:gap-6">
        <dt className="text-xs font-bold uppercase tracking-[.08em] text-white/45">{label}</dt>
        <dd className="m-0 font-medium text-white/86">{value}</dd>
      </div>)}
    </dl>
  </LegalDocument>;
}
