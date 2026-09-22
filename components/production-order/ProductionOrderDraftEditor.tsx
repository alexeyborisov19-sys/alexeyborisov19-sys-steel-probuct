"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import type { ProductionParameterSummary } from "@/lib/instant-quote/production-parameters";
import { buildProductionOrderFromProject } from "@/lib/production-order/build-production-order";
import type { ProductionOrder, ProductionOrderPriority } from "@/lib/production-order/domain";
import { ProductionOrderPrint } from "@/components/production-order/ProductionOrderPrint";

type PartEdit = {
  name: string;
  quantity: string;
  workshopNote: string;
};

type PackageResponse = {
  orderId: string;
  created: boolean;
  changed: boolean;
  folderPath: string;
  manifestPath: string;
  quotePdfPath: string;
  productionOrderPdfPath: string;
};

type SafePayload<T> = {
  ok?: boolean;
  data?: T;
  code?: string;
};

function requestError(code: string | undefined) {
  if (code === "VALIDATION_ERROR") return "Проверьте номер КП, название, заказчика, сроки и позиции.";
  if (code === "CONFLICT") return "Папка с таким номером и названием уже принадлежит другому заказу.";
  if (code === "BLOCKED") return "Сначала настройте и сохраните корневую папку заказов.";
  if (code === "CSRF_REJECTED") return "Сессия устарела. Обновите страницу и повторите действие.";
  if (code === "PERMISSION_DENIED") return "Недостаточно прав для создания папки заказа.";
  return "Не удалось создать папку заказа.";
}

function todayFromIso(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

export function ProductionOrderDraftEditor({
  csrfToken,
  project,
  productionParametersByPartId,
  initialCreatedAt,
  initialResponsible,
}: {
  csrfToken: string;
  project: InstantQuoteProject;
  productionParametersByPartId: Record<string, ProductionParameterSummary>;
  initialCreatedAt: string;
  initialResponsible: string;
}) {
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteTitle, setQuoteTitle] = useState(project.title === "Новый производственный проект" ? "" : project.title);
  const [customerName, setCustomerName] = useState("");
  const [launchDate, setLaunchDate] = useState(todayFromIso(initialCreatedAt));
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ProductionOrderPriority>("ordinary");
  const [responsible, setResponsible] = useState(initialResponsible);
  const [materialSource, setMaterialSource] = useState<"production" | "customer">("production");
  const [productionNote, setProductionNote] = useState("");
  const [partEdits, setPartEdits] = useState<Record<string, PartEdit>>(() => Object.fromEntries(
    project.parts.map((part) => [part.id, {
      name: part.fileName.replace(/\.[^.]+$/, "") || part.fileName,
      quantity: String(part.configuration.quantity),
      workshopNote: "",
    }]),
  ));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PackageResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const order = useMemo<ProductionOrder | null>(() => {
    if (!quoteNumber.trim() || !quoteTitle.trim() || !customerName.trim()) return null;
    try {
      const built = buildProductionOrderFromProject({
        project,
        quoteNumber,
        quoteTitle,
        customerName,
        launchDate: launchDate || null,
        dueDate: dueDate || null,
        priority,
        responsible,
        materialSource,
        productionParametersByPartId,
        productionNote,
        artifacts: project.parts.map((part) => ({
          id: `cad:${part.id}`,
          kind: "cad" as const,
          fileName: part.fileName,
          partId: part.id,
        })),
        commercialTotalRub: null,
        now: new Date(initialCreatedAt),
      });
      return {
        ...built,
        parts: built.parts.map((part) => {
          const edit = partEdits[part.partId];
          const quantity = Number(edit?.quantity);
          return {
            ...part,
            name: edit?.name.trim() || part.name,
            quantity: Number.isSafeInteger(quantity) && quantity > 0 ? quantity : part.quantity,
            workshopNote: edit?.workshopNote.trim() || null,
          };
        }),
      };
    } catch {
      return null;
    }
  }, [
    customerName,
    dueDate,
    initialCreatedAt,
    launchDate,
    materialSource,
    partEdits,
    priority,
    productionNote,
    productionParametersByPartId,
    project,
    quoteNumber,
    quoteTitle,
    responsible,
  ]);

  const updatePart = (partId: string, patch: Partial<PartEdit>) => {
    setPartEdits((current) => ({
      ...current,
      [partId]: { ...current[partId], ...patch },
    }));
    setResult(null);
  };

  const createPackage = async () => {
    setError(null);
    setMessage(null);
    setResult(null);
    if (!order) {
      setError("Заполните номер КП, название КП и заказчика.");
      return;
    }
    if (order.parts.some((part) => !part.name.trim() || part.quantity < 1)) {
      setError("У каждой позиции должны быть наименование и количество больше нуля.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/internal/production-order/package", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-steelprodukt-csrf": csrfToken,
        },
        body: JSON.stringify({ order }),
      });
      const payload = await response.json().catch(() => null) as SafePayload<PackageResponse> | null;
      if (!response.ok || !payload?.ok || !payload.data) throw new Error(requestError(payload?.code));
      setResult(payload.data);
      setMessage(payload.data.created
        ? "Папка заказа создана. Манифест расчёта сохранён."
        : payload.data.changed
          ? "Существующая папка заказа обновлена без создания дубля."
          : "Папка заказа уже существует, данные в ней актуальны.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : requestError(undefined));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="space-y-6">
    <div className="border border-white/10 bg-white/[.02] p-4 text-sm leading-relaxed text-white/60">
      Поля ниже заполняются перед фиксацией документов. Геометрия, материал, количество и операции уже перенесены из производственного расчёта, но наименование, количество и примечание цеху можно скорректировать.
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Номер КП *</span><input value={quoteNumber} onChange={(event) => { setQuoteNumber(event.target.value); setResult(null); }} placeholder="26-1649" className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block md:col-span-1 xl:col-span-2"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Название КП *</span><input value={quoteTitle} onChange={(event) => { setQuoteTitle(event.target.value); setResult(null); }} placeholder="ООО Ромашка — корпуса" className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block md:col-span-2 xl:col-span-1"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Заказчик *</span><input value={customerName} onChange={(event) => { setCustomerName(event.target.value); setResult(null); }} placeholder="ООО Ромашка" className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Дата запуска</span><input type="date" value={launchDate} onChange={(event) => { setLaunchDate(event.target.value); setResult(null); }} className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Срок готовности</span><input type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); setResult(null); }} className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Приоритет</span><select value={priority} onChange={(event) => { setPriority(event.target.value as ProductionOrderPriority); setResult(null); }} className="mt-2 min-h-11 w-full border border-white/15 bg-[#111519] px-3 py-2 outline-none focus:border-steel-orange/60"><option value="ordinary">Обычный</option><option value="urgent">Срочный</option><option value="critical">Критический</option></select></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Ответственный</span><input value={responsible} onChange={(event) => { setResponsible(event.target.value); setResult(null); }} className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Материал</span><select value={materialSource} onChange={(event) => { setMaterialSource(event.target.value as "production" | "customer"); setResult(null); }} className="mt-2 min-h-11 w-full border border-white/15 bg-[#111519] px-3 py-2 outline-none focus:border-steel-orange/60"><option value="production">Материал производства</option><option value="customer">Материал заказчика</option></select></label>
    </div>

    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Позиции заявки</h2><p className="mt-1 text-xs text-white/40">{project.parts.length} позиций · максимум 50</p></div></div>
      <div className="overflow-x-auto border border-white/10">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.1em] text-white/40"><tr><th className="p-3">№</th><th className="p-3">Файл</th><th className="p-3">Наименование</th><th className="p-3">Кол-во</th><th className="p-3">Материал</th><th className="p-3">Примечание цеху</th></tr></thead>
          <tbody>{project.parts.map((part, index) => {
            const edit = partEdits[part.id];
            const builtPart = order?.parts.find((item) => item.partId === part.id);
            return <tr key={part.id} className="border-b border-white/[.06] align-top">
              <td className="p-3 font-semibold">{index + 1}</td>
              <td className="p-3"><div className="max-w-[220px] break-all text-xs text-white/55">{part.fileName}</div></td>
              <td className="p-3"><input value={edit?.name ?? ""} onChange={(event) => updatePart(part.id, { name: event.target.value })} className="min-h-10 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></td>
              <td className="p-3"><input type="number" min={1} step={1} value={edit?.quantity ?? "1"} onChange={(event) => updatePart(part.id, { quantity: event.target.value })} className="min-h-10 w-24 border border-white/15 bg-black/20 px-3 py-2 text-right outline-none focus:border-steel-orange/60" /></td>
              <td className="p-3 text-xs text-white/60">{builtPart?.materialLabel ?? part.configuration.materialId ?? "—"}<br />{part.configuration.thicknessMm == null ? "" : `${part.configuration.thicknessMm} мм`}</td>
              <td className="p-3"><input value={edit?.workshopNote ?? ""} onChange={(event) => updatePart(part.id, { workshopNote: event.target.value })} placeholder="Только при необходимости" className="min-h-10 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>

    <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Общие указания производству</span><textarea value={productionNote} onChange={(event) => { setProductionNote(event.target.value); setResult(null); }} rows={4} placeholder="Критические размеры, требования к сварке, покрытию, качеству и упаковке" className="mt-2 w-full border border-white/15 bg-black/20 px-3 py-3 outline-none focus:border-steel-orange/60" /></label>

    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => void createPackage()} disabled={submitting || !order} className="min-h-12 border border-steel-orange bg-steel-orange px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">{submitting ? "Создаём папку…" : "Создать папку заказа"}</button>
      <button type="button" onClick={() => window.print()} disabled={!order} className="min-h-12 border border-white/20 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Печать заявки</button>
      <Link href="/internal/production-order/settings" className="flex min-h-12 items-center border border-white/20 px-5 py-3 text-sm font-semibold hover:border-white/45">Настроить путь</Link>
    </div>

    {message && <div className="border border-emerald-400/20 bg-emerald-400/[.04] p-4 text-sm text-emerald-100/85">{message}</div>}
    {error && <div className="border border-red-400/25 bg-red-400/[.05] p-4 text-sm text-red-200">{error}</div>}
    {result && <div className="grid gap-3 border border-white/10 bg-black/15 p-4 text-xs text-white/55 md:grid-cols-2">
      <div><div className="uppercase tracking-[.1em] text-white/30">Папка заказа</div><div className="mt-1 break-all font-mono text-white/75">{result.folderPath}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Манифест</div><div className="mt-1 break-all font-mono text-white/75">{result.manifestPath}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Путь будущего КП</div><div className="mt-1 break-all font-mono text-white/75">{result.quotePdfPath}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Путь будущей заявки</div><div className="mt-1 break-all font-mono text-white/75">{result.productionOrderPdfPath}</div></div>
    </div>}

    {order && <ProductionOrderPrint order={order} />}
  </div>;
}
