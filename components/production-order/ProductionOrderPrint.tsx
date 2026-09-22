import type { ProductionOrder } from "@/lib/production-order/domain";
import { groupProductionOrderRoutes, productionOrderVisibleSections } from "@/lib/production-order/build-production-order";

function date(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function dims(part: ProductionOrder["parts"][number]) {
  const values = [part.dimensionsMm.width, part.dimensionsMm.height, part.dimensionsMm.depth]
    .filter((value): value is number => value != null);
  return values.length ? `${values.join(" × ")} мм` : "—";
}

function priority(value: ProductionOrder["priority"]) {
  if (value === "urgent") return "Срочный";
  if (value === "critical") return "Критический";
  return "Обычный";
}

export function ProductionOrderPrint({ order }: { order: ProductionOrder }) {
  const routes = groupProductionOrderRoutes(order);
  const sections = productionOrderVisibleSections(order);

  return (
    <section className="production-order-print">
      <style>{`
        .production-order-print { display:none; color:#111; font-family:Arial,sans-serif; font-size:10pt; }
        .production-order-print h1 { font-size:18pt; margin:0 0 2mm; }
        .production-order-print h2 { font-size:11pt; margin:4mm 0 1.5mm; padding-bottom:1mm; border-bottom:0.3mm solid #cfcfcf; }
        .production-order-print table { width:100%; border-collapse:collapse; table-layout:fixed; }
        .production-order-print th,.production-order-print td { border:0.25mm solid #d5d5d5; padding:1.5mm 1.8mm; vertical-align:top; }
        .production-order-print th { font-size:8pt; font-weight:700; text-align:left; background:#f6f6f6; }
        .production-order-print tr { break-inside:avoid; }
        .production-order-print thead { display:table-header-group; }
        .production-order-print .meta td:nth-child(odd) { width:18%; font-size:8pt; font-weight:700; color:#666; background:#f6f6f6; }
        .production-order-print .meta td:nth-child(even) { width:32%; }
        .production-order-print .muted { color:#666; }
        @page { size:A4 portrait; margin:8mm; }
        @media print {
          body * { visibility:hidden !important; }
          .production-order-print,.production-order-print * { visibility:visible !important; }
          .production-order-print { display:block !important; position:absolute; inset:0; }
        }
      `}</style>

      <h1>ЗАЯВКА В ПРОИЗВОДСТВО № {order.quoteNumber}</h1>
      <div style={{ fontSize: "12pt", fontWeight: 700, marginBottom: "2mm" }}>Заказчик: {order.customerName}</div>
      <div className="muted">{order.quoteTitle}</div>

      <h2>1. Основные данные</h2>
      <table className="meta">
        <tbody>
          <tr><td>Дата заявки</td><td>{new Date(order.createdAt).toLocaleDateString("ru-RU")}</td><td>Срок готовности</td><td>{date(order.dueDate)}</td></tr>
          <tr><td>Дата запуска</td><td>{date(order.launchDate)}</td><td>Приоритет</td><td>{priority(order.priority)}</td></tr>
          <tr><td>Материал</td><td>{order.materialSource === "customer" ? "Материал заказчика" : "Материал производства"}</td><td>Ответственный</td><td>{order.responsible ?? "—"}</td></tr>
        </tbody>
      </table>

      <h2>2. Изделия</h2>
      <table>
        <thead><tr><th style={{ width:"5%" }}>№</th><th style={{ width:"24%" }}>Наименование</th><th style={{ width:"8%" }}>Кол-во</th><th style={{ width:"20%" }}>Материал</th><th style={{ width:"11%" }}>Толщина</th><th style={{ width:"16%" }}>Габарит</th><th style={{ width:"16%" }}>CAD / примечание</th></tr></thead>
        <tbody>
          {order.parts.map((part) => (
            <tr key={part.partId}>
              <td>{part.position}</td>
              <td>{part.name}</td>
              <td>{part.quantity}</td>
              <td>{part.materialLabel}</td>
              <td>{part.thicknessMm == null ? "—" : `${part.thicknessMm} мм`}</td>
              <td>{dims(part)}</td>
              <td>{part.fileName}{part.workshopNote ? <><br />{part.workshopNote}</> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sections.routes && <>
        <h2>3. Маршрут производства</h2>
        <table>
          <thead><tr><th style={{ width:"26%" }}>Операция</th><th style={{ width:"18%" }}>Позиции</th><th style={{ width:"31%" }}>Объём / параметр</th><th style={{ width:"25%" }}>Источник</th></tr></thead>
          <tbody>{routes.map((route) => (
            <tr key={`${route.code}-${route.parameter ?? ""}-${route.source}`}>
              <td>{route.label}</td>
              <td>{route.positions.join(", ")}</td>
              <td>{route.parameter ?? "уточнить при необходимости"}</td>
              <td>{route.source === "cad" ? "CAD" : route.source === "calculation" ? "расчёт" : route.source === "mixed" ? "CAD / расчёт" : "вручную"}</td>
            </tr>
          ))}</tbody>
        </table>
      </>}

      {order.productionNote && <>
        <h2>4. Указания производству</h2>
        <div style={{ whiteSpace:"pre-wrap" }}>{order.productionNote}</div>
      </>}

      {sections.files && <>
        <h2>5. Файлы производства</h2>
        <table>
          <thead><tr><th>Файл</th><th>Тип</th><th>Позиция</th></tr></thead>
          <tbody>{order.artifacts.map((artifact) => (
            <tr key={artifact.id}><td>{artifact.fileName}</td><td>{artifact.kind === "cad" ? "CAD" : artifact.kind === "drawing" ? "Чертёж" : "Вложение"}</td><td>{artifact.partId ? order.parts.find((part) => part.partId === artifact.partId)?.position ?? "—" : "—"}</td></tr>
          ))}</tbody>
        </table>
      </>}

      {sections.delivery && order.delivery && <>
        <h2>6. Доставка / получение</h2>
        <table className="meta"><tbody>
          <tr><td>Способ</td><td>{order.delivery.method}</td><td>Дата отгрузки</td><td>{date(order.delivery.shipmentDate)}</td></tr>
          {(order.delivery.addressOrCarrier || order.delivery.comment) && <tr><td>Адрес / ТК</td><td>{order.delivery.addressOrCarrier ?? "—"}</td><td>Комментарий</td><td>{order.delivery.comment ?? "—"}</td></tr>}
        </tbody></table>
      </>}
    </section>
  );
}
