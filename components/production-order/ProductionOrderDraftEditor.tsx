"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InstantQuoteProject } from "@/lib/instant-quote/domain";
import type { ProductionParameterSummary } from "@/lib/instant-quote/production-parameters";
import {
  buildProductionOrderFromProject,
  type ProductionOrderCommercialPartInput,
} from "@/lib/production-order/build-production-order";
import type {
  ProductionOrder,
  ProductionOrderArtifact,
  ProductionOrderCommercialStatus,
  ProductionOrderPriority,
} from "@/lib/production-order/domain";
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
  revision: number;
  folderPath: string;
  manifestPath: string;
  journalPath: string;
  revisionDirectory: string;
  quotePdfPath: string;
  productionOrderPdfPath: string;
  documentStatus: "generated" | "unavailable" | "failed";
  artifactStatus: "copied" | "not-requested" | "failed";
  copiedArtifacts: Array<{ artifactId: string; destinationPath: string }>;
  warnings: string[];
};

type BitrixResponse = {
  dealId: number;
  created: boolean;
  folderPath: string;
  revision: number;
};

type SafePayload<T> = {
  ok?: boolean;
  data?: T;
  code?: string;
};

function requestError(code: string | undefined, action: "package" | "bitrix") {
  if (code === "VALIDATION_ERROR") return "Проверьте номер КП, название, заказчика, сроки и позиции.";
  if (code === "CONFLICT") return "Папка с таким номером и названием уже принадлежит другому заказу.";
  if (code === "BLOCKED") {
    return action === "bitrix"
      ? "Интеграция Bitrix24 ещё не настроена: проверьте webhook, воронку и стадию."
      : "Сначала настройте папку заказов. Для автоматического PDF также требуется Chrome, Edge или Chromium.";
  }
  if (code === "CSRF_REJECTED") return "Сессия устарела. Обновите страницу и повторите действие.";
  if (code === "PERMISSION_DENIED") return "Недостаточно прав для выполнения операции.";
  return action === "bitrix" ? "Не удалось создать или обновить сделку в Bitrix24." : "Не удалось создать пакет заказа.";
}

function todayFromIso(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function commercialStatus(parts: ProductionOrder["parts"]): ProductionOrderCommercialStatus {
  if (!parts.every((part) => part.commercial.totalRub != null)) return "unavailable";
  if (parts.some((part) => part.commercial.status === "estimate")) return "estimate";
  return parts.every((part) => part.commercial.status === "approved") ? "approved" : "estimate";
}

export function ProductionOrderDraftEditor({
  csrfToken,
  project,
  productionParametersByPartId,
  initialCreatedAt,
  initialResponsible,
  initialArtifacts,
  commercialByPartId,
}: {
  csrfToken: string;
  project: InstantQuoteProject;
  productionParametersByPartId: Record<string, ProductionParameterSummary>;
  initialCreatedAt: string;
  initialResponsible: string;
  initialArtifacts: ProductionOrderArtifact[];
  commercialByPartId: Record<string, ProductionOrderCommercialPartInput>;
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
  const [bitrixSubmitting, setBitrixSubmitting] = useState(false);
  const [result, setResult] = useState<PackageResponse | null>(null);
  const [bitrixResult, setBitrixResult] = useState<BitrixResponse | null>(null);
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
        artifacts: initialArtifacts,
        commercialByPartId,
        now: new Date(initialCreatedAt),
      });
      const editedParts = built.parts.map((part) => {
        const edit = partEdits[part.partId];
        const quantity = Number(edit?.quantity);
        const nextQuantity = Number.isSafeInteger(quantity) && quantity > 0 ? quantity : part.quantity;
        const originalQuantity = project.parts.find((item) => item.id === part.partId)?.configuration.quantity ?? part.quantity;
        return {
          ...part,
          name: edit?.name.trim() || part.name,
          quantity: nextQuantity,
          workshopNote: edit?.workshopNote.trim() || null,
          commercial: nextQuantity === originalQuantity
            ? part.commercial
            : { totalRub: null, status: "unavailable" as const },
        };
      });
      const status = commercialStatus(editedParts);
      return {
        ...built,
        parts: editedParts,
        commercial: {
          ...built.commercial,
          totalRub: status === "unavailable"
            ? null
            : editedParts.reduce((sum, part) => sum + (part.commercial.totalRub ?? 0), 0),
          status,
        },
      };
    } catch {
      return null;
    }
  }, [
    commercialByPartId,
    customerName,
    dueDate,
    initialArtifacts,
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

  const invalidateResult = () => {
    setResult(null);
    setBitrixResult(null);
  };

  const updatePart = (partId: string, patch: Partial<PartEdit>) => {
    setPartEdits((current) => ({
      ...current,
      [partId]: { ...current[partId], ...patch },
    }));
    invalidateResult();
  };

  const createPackage = async () => {
    setError(null);
    setMessage(null);
    setResult(null);
    setBitrixResult(null);
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
      if (!response.ok || !payload?.ok || !payload.data) throw new Error(requestError(payload?.code, "package"));
      setResult(payload.data);
      const base = payload.data.created
        ? `Пакет заказа создан. Ревизия ${payload.data.revision}.`
        : payload.data.changed
          ? `Пакет заказа обновлён без дубля. Ревизия ${payload.data.revision}.`
          : `Пакет уже существует и актуален. Ревизия ${payload.data.revision}.`;
      setMessage([base, ...payload.data.warnings].join(" "));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : requestError(undefined, "package"));
    } finally {
      setSubmitting(false);
    }
  };

  const createBitrix = async () => {
    setError(null);
    setMessage(null);
    setBitrixResult(null);
    if (!order || !result) {
      setError("Сначала создайте и сохраните пакет заказа.");
      return;
    }
    setBitrixSubmitting(true);
    try {
      const response = await fetch("/api/internal/production-order/bitrix", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-steelprodukt-csrf": csrfToken,
        },
        body: JSON.stringify({ order }),
      });
      const payload = await response.json().catch(() => null) as SafePayload<BitrixResponse> | null;
      if (!response.ok || !payload?.ok || !payload.data) throw new Error(requestError(payload?.code, "bitrix"));
      setBitrixResult(payload.data);
      setMessage(payload.data.created
        ? `Сделка Bitrix24 №${payload.data.dealId} создана в заданной колонке.`
        : `Сделка Bitrix24 №${payload.data.dealId} обновлена без создания дубля.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : requestError(undefined, "bitrix"));
    } finally {
      setBitrixSubmitting(false);
    }
  };

  const filesAvailable = initialArtifacts.length;

  return <div className="space-y-6">
    <div className="border border-white/10 bg-white/[.02] p-4 text-sm leading-relaxed text-white/60">
      Поля ниже заполняются перед фиксацией документов. Геометрия, материал, количество и операции уже перенесены из производственного расчёта, но наименование, количество и примечание цеху можно скорректировать.
    </div>

    {filesAvailable < project.parts.length && <div className="border border-amber-400/20 bg-amber-400/[.04] p-4 text-sm text-amber-100/80">
      Защищённые исходные CAD-файлы найдены для {filesAvailable} из {project.parts.length} позиций. Для старых расчётов без файловых ссылок папка и PDF создадутся, но отсутствующие CAD-файлы автоматически не скопируются.
    </div>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Номер КП *</span><input value={quoteNumber} onChange={(event) => { setQuoteNumber(event.target.value); invalidateResult(); }} placeholder="26-1649" className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block md:col-span-1 xl:col-span-2"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Название КП *</span><input value={quoteTitle} onChange={(event) => { setQuoteTitle(event.target.value); invalidateResult(); }} placeholder="ООО Ромашка — корпуса" className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block md:col-span-2 xl:col-span-1"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Заказчик *</span><input value={customerName} onChange={(event) => { setCustomerName(event.target.value); invalidateResult(); }} placeholder="ООО Ромашка" className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Дата запуска</span><input type="date" value={launchDate} onChange={(event) => { setLaunchDate(event.target.value); invalidateResult(); }} className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Срок готовности</span><input type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); invalidateResult(); }} className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Приоритет</span><select value={priority} onChange={(event) => { setPriority(event.target.value as ProductionOrderPriority); invalidateResult(); }} className="mt-2 min-h-11 w-full border border-white/15 bg-[#111519] px-3 py-2 outline-none focus:border-steel-orange/60"><option value="ordinary">Обычный</option><option value="urgent">Срочный</option><option value="critical">Критический</option></select></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Ответственный</span><input value={responsible} onChange={(event) => { setResponsible(event.target.value); invalidateResult(); }} className="mt-2 min-h-11 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></label>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Материал</span><select value={materialSource} onChange={(event) => { setMaterialSource(event.target.value as "production" | "customer"); invalidateResult(); }} className="mt-2 min-h-11 w-full border border-white/15 bg-[#111519] px-3 py-2 outline-none focus:border-steel-orange/60"><option value="production">Материал производства</option><option value="customer">Материал заказчика</option></select></label>
    </div>

    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Позиции заявки</h2><p className="mt-1 text-xs text-white/40">{project.parts.length} позиций · максимум 50</p></div></div>
      <div className="overflow-x-auto border border-white/10">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.1em] text-white/40"><tr><th className="p-3">№</th><th className="p-3">Файл</th><th className="p-3">Наименование</th><th className="p-3">Кол-во</th><th className="p-3">Материал</th><th className="p-3">Цена КП</th><th className="p-3">Примечание цеху</th></tr></thead>
          <tbody>{project.parts.map((part, index) => {
            const edit = partEdits[part.id];
            const builtPart = order?.parts.find((item) => item.partId === part.id);
            return <tr key={part.id} className="border-b border-white/[.06] align-top">
              <td className="p-3 font-semibold">{index + 1}</td>
              <td className="p-3"><div className="max-w-[220px] break-all text-xs text-white/55">{part.fileName}</div></td>
              <td className="p-3"><input value={edit?.name ?? ""} onChange={(event) => updatePart(part.id, { name: event.target.value })} className="min-h-10 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></td>
              <td className="p-3"><input type="number" min={1} step={1} value={edit?.quantity ?? "1"} onChange={(event) => updatePart(part.id, { quantity: event.target.value })} className="min-h-10 w-24 border border-white/15 bg-black/20 px-3 py-2 text-right outline-none focus:border-steel-orange/60" /></td>
              <td className="p-3 text-xs text-white/60">{builtPart?.materialLabel ?? part.configuration.materialId ?? "—"}<br />{part.configuration.thicknessMm == null ? "" : `${part.configuration.thicknessMm} мм`}</td>
              <td className="p-3 text-xs text-white/60">{builtPart?.commercial.totalRub == null ? "по согласованию" : `${builtPart.commercial.totalRub.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`}{builtPart?.commercial.status === "estimate" ? <div className="mt-1 text-amber-200/70">ориентировочно</div> : null}</td>
              <td className="p-3"><input value={edit?.workshopNote ?? ""} onChange={(event) => updatePart(part.id, { workshopNote: event.target.value })} placeholder="Только при необходимости" className="min-h-10 w-full border border-white/15 bg-black/20 px-3 py-2 outline-none focus:border-steel-orange/60" /></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>

    <label className="block"><span className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Общие указания производству</span><textarea value={productionNote} onChange={(event) => { setProductionNote(event.target.value); invalidateResult(); }} rows={4} placeholder="Критические размеры, требования к сварке, покрытию, качеству и упаковке" className="mt-2 w-full border border-white/15 bg-black/20 px-3 py-3 outline-none focus:border-steel-orange/60" /></label>

    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => void createPackage()} disabled={submitting || !order} className="min-h-12 border border-steel-orange bg-steel-orange px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">{submitting ? "Формируем пакет…" : "Создать КП и заявку"}</button>
      <button type="button" onClick={() => void createBitrix()} disabled={bitrixSubmitting || !result || !order} className="min-h-12 border border-white/20 px-5 py-3 text-sm font-semibold transition hover:border-steel-orange/70 disabled:cursor-not-allowed disabled:opacity-40">{bitrixSubmitting ? "Отправляем в Bitrix24…" : bitrixResult ? "Обновить заявку в Bitrix24" : "Создать заявку в Bitrix24"}</button>
      <button type="button" onClick={() => window.print()} disabled={!order} className="min-h-12 border border-white/20 px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Печать заявки</button>
      <Link href="/internal/production-order/settings" className="flex min-h-12 items-center border border-white/20 px-5 py-3 text-sm font-semibold hover:border-white/45">Настроить путь</Link>
    </div>

    {message && <div className="border border-emerald-400/20 bg-emerald-400/[.04] p-4 text-sm text-emerald-100/85">{message}</div>}
    {error && <div className="border border-red-400/25 bg-red-400/[.05] p-4 text-sm text-red-200">{error}</div>}
    {result && <div className="grid gap-3 border border-white/10 bg-black/15 p-4 text-xs text-white/55 md:grid-cols-2 xl:grid-cols-3">
      <div><div className="uppercase tracking-[.1em] text-white/30">Папка заказа</div><div className="mt-1 break-all font-mono text-white/75">{result.folderPath}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Ревизия</div><div className="mt-1 font-semibold text-white/80">{result.revision}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Исходные файлы</div><div className="mt-1 text-white/75">{result.artifactStatus === "copied" ? `Скопировано: ${result.copiedArtifacts.length}` : result.artifactStatus === "not-requested" ? "Нет файлов для копирования" : "Не скопированы"}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">КП PDF</div><div className="mt-1 break-all font-mono text-white/75">{result.quotePdfPath}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Заявка PDF</div><div className="mt-1 break-all font-mono text-white/75">{result.productionOrderPdfPath}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">PDF</div><div className="mt-1 text-white/75">{result.documentStatus === "generated" ? "Сформированы" : result.documentStatus === "unavailable" ? "Нет браузера для генерации" : "Ошибка формирования"}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Манифест</div><div className="mt-1 break-all font-mono text-white/75">{result.manifestPath}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Журнал</div><div className="mt-1 break-all font-mono text-white/75">{result.journalPath}</div></div>
      <div><div className="uppercase tracking-[.1em] text-white/30">Архив ревизии</div><div className="mt-1 break-all font-mono text-white/75">{result.revisionDirectory}</div></div>
    </div>}

    {bitrixResult && <div className="border border-white/10 bg-black/15 p-4 text-sm text-white/70">Bitrix24: сделка №<b className="text-white">{bitrixResult.dealId}</b> · {bitrixResult.created ? "создана" : "обновлена"} · ревизия {bitrixResult.revision}</div>}

    {order && <ProductionOrderPrint order={order} />}
  </div>;
}
