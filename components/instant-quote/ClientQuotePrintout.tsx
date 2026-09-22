import type { ClientProjectCalculationView } from "@/lib/instant-quote/client-calculation-view";
import { CALCULATION_DISCLAIMER, materialLabel, operationLabels } from "@/lib/instant-quote/client-labels";
import { legalOperator } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

function rub(value: number) {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function dimensions(cad: { widthMm: number | null; heightMm: number | null; depthMm: number | null }) {
  const values = [cad.widthMm, cad.heightMm, cad.depthMm].filter((value): value is number => value != null);
  if (!values.length) return "—";
  return `${values.map((value) => value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })).join(" × ")} мм`;
}

/**
 * Printable preliminary quote. It is built only from the public client
 * calculation view, so it can never carry supplier prices, production rates or
 * any other part of the calculation basis.
 */
export function ClientQuotePrintout({
  calculation,
  totalRub,
  preparedAt,
}: {
  calculation: ClientProjectCalculationView;
  totalRub: number | null;
  preparedAt: Date;
}) {
  const priced = calculation.parts.filter((part) => ["approved", "estimate"].includes(part.price.status) && part.price.totalRub != null);

  return (
    <section className="quote-print-root" aria-hidden="true">
      <header style={{ borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 16 }}>
        <img src={siteConfig.logo} alt={siteConfig.name} style={{ height: 40, width: "auto" }} />
        <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.5 }}>
          {legalOperator.shortName} · ИНН {legalOperator.inn} · ОГРН {legalOperator.ogrn}
          <br />
          Производство: {legalOperator.productionAddress}
          <br />
          {legalOperator.phone} · {legalOperator.email} · {siteConfig.hostDisplay}
        </p>
      </header>

      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Предварительный расчёт</h1>
      <p style={{ margin: "0 0 16px", fontSize: 12 }}>
        {calculation.title} · подготовлен {preparedAt.toLocaleDateString("ru-RU")}
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {["№", "Файл", "Материал", "Толщина", "Габариты", "Кол-во", "Обработка", "Сумма"].map((title) => (
              <th key={title} style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "left", background: "#eee" }}>
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calculation.parts.map((part, index) => (
            <tr key={part.partId}>
              <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{index + 1}</td>
              <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{part.fileName}</td>
              <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{materialLabel(part.configuration.materialId)}</td>
              <td style={{ border: "1px solid #999", padding: "4px 6px" }}>
                {part.configuration.thicknessMm == null ? "—" : `${part.configuration.thicknessMm} мм`}
              </td>
              <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{dimensions(part.cad)}</td>
              <td style={{ border: "1px solid #999", padding: "4px 6px" }}>{part.configuration.quantity}</td>
              <td style={{ border: "1px solid #999", padding: "4px 6px" }}>
                {operationLabels(part.configuration.operations).join(", ") || "—"}
              </td>
              <td style={{ border: "1px solid #999", padding: "4px 6px", textAlign: "right" }}>
                {["approved", "estimate"].includes(part.price.status) && part.price.totalRub != null ? `${rub(part.price.totalRub)} ₽${part.price.status === "estimate" ? " (ориентировочно)" : ""}` : "по запросу"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalRub != null && priced.length === calculation.parts.length && (
        <p style={{ marginTop: 12, fontSize: 14, fontWeight: 700, textAlign: "right" }}>
          Итого предварительно: {rub(totalRub)} ₽
        </p>
      )}

      {calculation.parts.some(part => part.price.status === "estimate") && <p>Ориентировочная стоимость. Изготовляемость, зоны гиба и окончательную цену подтвердит инженер. Запуск в производство не согласован.</p>}
      <p style={{ marginTop: 18, fontSize: 10, lineHeight: 1.6, color: "#333" }}>
        {CALCULATION_DISCLAIMER} Оплата на сайте не подключена.
      </p>
    </section>
  );
}
