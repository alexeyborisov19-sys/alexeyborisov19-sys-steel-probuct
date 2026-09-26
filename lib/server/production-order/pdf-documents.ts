import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ProductionOrder } from "@/lib/production-order/domain";
import { groupProductionOrderRoutes, productionOrderVisibleSections } from "@/lib/production-order/build-production-order";
import { legalOperator } from "@/lib/legal";
import { siteConfig } from "@/lib/site";
import {
  productionOrderRevisionDirectory,
  type ProductionOrderPackagePlan,
} from "@/lib/server/production-order/storage";

export class PdfRendererUnavailableError extends Error {
  constructor(message = "Не найден Chrome, Edge или Chromium для автоматического создания PDF.") {
    super(message);
    this.name = "PdfRendererUnavailableError";
  }
}

function html(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rub(value: number | null) {
  return value == null ? "по согласованию" : `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

function date(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function dimensions(part: ProductionOrder["parts"][number]) {
  const values = [part.dimensionsMm.width, part.dimensionsMm.height, part.dimensionsMm.depth]
    .filter((value): value is number => value != null);
  return values.length ? `${values.map((value) => value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })).join(" × ")} мм` : "—";
}

function priority(value: ProductionOrder["priority"]) {
  if (value === "urgent") return "Срочный";
  if (value === "critical") return "Критический";
  return "Обычный";
}

function sourceLabel(value: string) {
  if (value === "cad") return "CAD";
  if (value === "calculation") return "расчёт";
  if (value === "mixed") return "CAD / расчёт";
  return "вручную";
}

function documentShell(title: string, body: string) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${html(title)}</title>
<style>
  @page { size: A4 portrait; margin: 9mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #171717; font-family: Arial, "Helvetica Neue", sans-serif; font-size: 10pt; }
  h1 { margin: 0 0 2mm; font-size: 18pt; line-height: 1.1; }
  h2 { margin: 4mm 0 1.5mm; padding-bottom: 1mm; border-bottom: .25mm solid #cfcfcf; font-size: 11pt; line-height: 1.2; }
  p { margin: 0 0 2mm; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: .22mm solid #d5d5d5; padding: 1.45mm 1.6mm; vertical-align: top; word-break: break-word; }
  th { background: #f6f6f6; color: #555; font-size: 7.8pt; text-align: left; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .meta td:nth-child(odd) { width: 18%; background: #f6f6f6; color: #666; font-size: 8pt; font-weight: 700; }
  .meta td:nth-child(even) { width: 32%; }
  .muted { color: #666; }
  .right { text-align: right; }
  .nowrap { white-space: nowrap; }
  .total { margin-top: 3mm; font-size: 13pt; font-weight: 700; text-align: right; }
  .note { margin-top: 3mm; padding: 2mm; border: .22mm solid #d5d5d5; white-space: pre-wrap; }
  .brand { font-size: 13pt; font-weight: 800; letter-spacing: .03em; }
  .small { font-size: 8pt; line-height: 1.45; }
</style>
</head>
<body>${body}</body>
</html>`;
}

export function renderCommercialQuoteHtml(order: ProductionOrder) {
  const rows = order.parts.map((part) => `
    <tr>
      <td>${part.position}</td>
      <td><strong>${html(part.name)}</strong><br /><span class="muted small">${html(part.fileName)}</span></td>
      <td>${html(part.materialLabel)}${part.thicknessMm == null ? "" : `<br />${html(part.thicknessMm)} мм`}</td>
      <td>${part.quantity}</td>
      <td>${html(part.operations.map((operation) => operation.label).join(", ") || "—")}</td>
      <td class="right nowrap">${html(rub(part.commercial.totalRub))}${part.commercial.status === "estimate" ? "<br /><span class=\"muted small\">ориентировочно</span>" : ""}</td>
    </tr>`).join("");

  const body = `
    <header style="border-bottom:.45mm solid #222;padding-bottom:3mm;margin-bottom:4mm">
      <div class="brand">${html(siteConfig.name)}</div>
      <div class="small" style="margin-top:2mm">
        ${html(legalOperator.shortName)} · ИНН ${html(legalOperator.inn)} · ОГРН ${html(legalOperator.ogrn)}<br />
        Производство: ${html(legalOperator.productionAddress)}<br />
        ${html(legalOperator.phone)} · ${html(legalOperator.email)} · ${html(siteConfig.hostDisplay)}
      </div>
    </header>
    <h1>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${html(order.quoteNumber)}</h1>
    <p><strong>${html(order.quoteTitle)}</strong></p>
    <table class="meta"><tbody>
      <tr><td>Заказчик</td><td>${html(order.customerName)}</td><td>Дата</td><td>${new Date(order.createdAt).toLocaleDateString("ru-RU")}</td></tr>
      <tr><td>Срок готовности</td><td>${date(order.dueDate)}</td><td>Ответственный</td><td>${html(order.responsible ?? "—")}</td></tr>
    </tbody></table>
    <h2>Состав предложения</h2>
    <table>
      <thead><tr><th style="width:5%">№</th><th style="width:27%">Изделие</th><th style="width:18%">Материал</th><th style="width:8%">Кол-во</th><th style="width:27%">Обработка</th><th style="width:15%">Сумма</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Итого: ${html(rub(order.commercial.totalRub))}${order.commercial.status === "estimate" ? " (ориентировочно)" : ""}</div>
    <div class="note small">Расчёт сформирован по данным CAD и указанным параметрам. Окончательные цена, сроки и условия изготовления подтверждаются после инженерной проверки и фиксируются договором или счётом.</div>`;
  return documentShell(`КП ${order.quoteNumber}`, body);
}

export function renderProductionOrderHtml(order: ProductionOrder) {
  const routes = groupProductionOrderRoutes(order);
  const sections = productionOrderVisibleSections(order);
  const rows = order.parts.map((part) => `
    <tr>
      <td>${part.position}</td>
      <td><strong>${html(part.name)}</strong></td>
      <td>${part.quantity}</td>
      <td>${html(part.materialLabel)}</td>
      <td>${part.thicknessMm == null ? "—" : `${html(part.thicknessMm)} мм`}</td>
      <td>${html(dimensions(part))}</td>
      <td>${html(part.fileName)}${part.workshopNote ? `<br />${html(part.workshopNote)}` : ""}</td>
    </tr>`).join("");
  const routeRows = routes.map((route) => `
    <tr><td>${html(route.label)}</td><td>${route.positions.join(", ")}</td><td>${html(route.parameter ?? "уточнить при необходимости")}</td><td>${html(sourceLabel(route.source))}</td></tr>`).join("");
  const fileRows = order.artifacts.map((artifact) => {
    const part = artifact.partId ? order.parts.find((item) => item.partId === artifact.partId) : null;
    const type = artifact.kind === "cad" ? "CAD" : artifact.kind === "drawing" ? "Чертёж" : "Вложение";
    return `<tr><td>${html(artifact.fileName)}</td><td>${type}</td><td>${part?.position ?? "—"}</td></tr>`;
  }).join("");

  const body = `
    <h1>ЗАЯВКА В ПРОИЗВОДСТВО № ${html(order.quoteNumber)}</h1>
    <p style="font-size:12pt;font-weight:700">Заказчик: ${html(order.customerName)}</p>
    <p class="muted">${html(order.quoteTitle)}</p>
    <h2>1. Основные данные</h2>
    <table class="meta"><tbody>
      <tr><td>Дата заявки</td><td>${new Date(order.createdAt).toLocaleDateString("ru-RU")}</td><td>Срок готовности</td><td>${date(order.dueDate)}</td></tr>
      <tr><td>Дата запуска</td><td>${date(order.launchDate)}</td><td>Приоритет</td><td>${priority(order.priority)}</td></tr>
      <tr><td>Материал</td><td>${order.materialSource === "customer" ? "Материал заказчика" : "Материал производства"}</td><td>Ответственный</td><td>${html(order.responsible ?? "—")}</td></tr>
    </tbody></table>
    <h2>2. Изделия</h2>
    <table>
      <thead><tr><th style="width:5%">№</th><th style="width:24%">Наименование</th><th style="width:8%">Кол-во</th><th style="width:20%">Материал</th><th style="width:11%">Толщина</th><th style="width:16%">Габарит</th><th style="width:16%">CAD / примечание</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${sections.routes ? `<h2>3. Маршрут производства</h2><table><thead><tr><th style="width:26%">Операция</th><th style="width:18%">Позиции</th><th style="width:31%">Объём / параметр</th><th style="width:25%">Источник</th></tr></thead><tbody>${routeRows}</tbody></table>` : ""}
    ${order.productionNote ? `<h2>4. Указания производству</h2><div class="note">${html(order.productionNote)}</div>` : ""}
    ${sections.files ? `<h2>5. Файлы производства</h2><table><thead><tr><th>Файл</th><th>Тип</th><th>Позиция</th></tr></thead><tbody>${fileRows}</tbody></table>` : ""}
    ${sections.delivery && order.delivery ? `<h2>6. Доставка / получение</h2><table class="meta"><tbody><tr><td>Способ</td><td>${html(order.delivery.method)}</td><td>Дата отгрузки</td><td>${date(order.delivery.shipmentDate)}</td></tr>${order.delivery.addressOrCarrier || order.delivery.comment ? `<tr><td>Адрес / ТК</td><td>${html(order.delivery.addressOrCarrier ?? "—")}</td><td>Комментарий</td><td>${html(order.delivery.comment ?? "—")}</td></tr>` : ""}</tbody></table>` : ""}`;
  return documentShell(`Заявка ${order.quoteNumber}`, body);
}

function exec(command: string, args: string[], timeout = 120_000) {
  return new Promise<void>((resolve, reject) => {
    execFile(command, args, { timeout, maxBuffer: 1024 * 1024, windowsHide: true }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function browserCandidates(environment: Readonly<Record<string, string | undefined>>, platform: NodeJS.Platform) {
  const explicit = environment.STEEL_PRODUCT_PDF_BROWSER_PATH?.trim();
  const candidates = explicit ? [explicit] : [];
  if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else if (platform === "win32") {
    for (const root of [environment.PROGRAMFILES, environment["PROGRAMFILES(X86)"], environment.LOCALAPPDATA]) {
      if (!root) continue;
      candidates.push(
        path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(root, "Chromium", "Application", "chrome.exe"),
      );
    }
  } else {
    candidates.push("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge");
  }
  return [...new Set(candidates)];
}

async function usableBrowser(candidate: string) {
  if (path.isAbsolute(candidate)) {
    try {
      await access(candidate);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await exec(candidate, ["--version"], 5_000);
    return true;
  } catch {
    return false;
  }
}

export async function resolvePdfBrowser(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  platform: NodeJS.Platform = process.platform,
) {
  for (const candidate of browserCandidates(environment, platform)) {
    if (await usableBrowser(candidate)) return candidate;
  }
  throw new PdfRendererUnavailableError();
}

async function renderHtmlToPdf(input: {
  browser: string;
  htmlContent: string;
  targetPath: string;
  environment: Readonly<Record<string, string | undefined>>;
}) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "steelprodukt-pdf-"));
  const htmlPath = path.join(temporary, "document.html");
  const profilePath = path.join(temporary, "profile");
  await mkdir(profilePath, { recursive: true, mode: 0o700 });
  await mkdir(path.dirname(input.targetPath), { recursive: true, mode: 0o700 });
  await writeFile(htmlPath, input.htmlContent, { encoding: "utf8", mode: 0o600 });

  const common = [
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--allow-file-access-from-files",
    "--no-pdf-header-footer",
    `--user-data-dir=${profilePath}`,
    `--print-to-pdf=${path.resolve(input.targetPath)}`,
    pathToFileURL(htmlPath).href,
  ];
  if (input.environment.STEEL_PRODUCT_PDF_NO_SANDBOX === "true") common.unshift("--no-sandbox");

  try {
    try {
      await exec(input.browser, ["--headless=new", ...common]);
    } catch {
      await exec(input.browser, ["--headless", ...common]);
    }
    const info = await stat(input.targetPath);
    if (!info.isFile() || info.size < 100) throw new Error("PDF renderer did not create a valid file");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function generateProductionOrderDocuments(input: {
  order: ProductionOrder;
  plan: ProductionOrderPackagePlan;
  revision: number;
  environment?: Readonly<Record<string, string | undefined>>;
}) {
  const environment = input.environment ?? process.env;
  const browser = await resolvePdfBrowser(environment);
  await renderHtmlToPdf({
    browser,
    htmlContent: renderCommercialQuoteHtml(input.order),
    targetPath: input.plan.quotePdfPath,
    environment,
  });
  await renderHtmlToPdf({
    browser,
    htmlContent: renderProductionOrderHtml(input.order),
    targetPath: input.plan.productionOrderPdfPath,
    environment,
  });

  const revisionDirectory = productionOrderRevisionDirectory(input.plan, input.revision);
  await mkdir(revisionDirectory, { recursive: true, mode: 0o700 });
  const revisionQuotePath = path.join(revisionDirectory, path.basename(input.plan.quotePdfPath));
  const revisionProductionOrderPath = path.join(revisionDirectory, path.basename(input.plan.productionOrderPdfPath));
  await Promise.all([
    copyFile(input.plan.quotePdfPath, revisionQuotePath),
    copyFile(input.plan.productionOrderPdfPath, revisionProductionOrderPath),
  ]);

  return {
    browser,
    quotePdfPath: input.plan.quotePdfPath,
    productionOrderPdfPath: input.plan.productionOrderPdfPath,
    revisionQuotePath,
    revisionProductionOrderPath,
  };
}
