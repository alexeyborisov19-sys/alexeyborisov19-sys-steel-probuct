import { PRODUCT_CALCULATION_NOTICE } from "../product-calculation-notice";
import { estimateCassetteProjectBudget } from "./budget";
import { buildCassetteElevation, CASSETTE_PROJECT_LIMITS, CASSETTE_PROJECT_SCOPE, cassettePanelStatusLabels, normalizeCassetteProject, type CassetteProject } from "./model";

export function serializeCassetteProject(value: CassetteProject): string {
  return JSON.stringify({ ...normalizeCassetteProject(value), notice: PRODUCT_CALCULATION_NOTICE }, null, 2);
}
export function parseCassetteProject(text: string): CassetteProject {
  if (new TextEncoder().encode(text).length > CASSETTE_PROJECT_LIMITS.fileBytes) throw new Error("Файл проекта превышает 1 МБ.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Не удалось прочитать JSON. Выберите сохранённый файл проекта металлокассет."); }
  return normalizeCassetteProject(value);
}
function csvCell(value: unknown) {
  const text = String(value);
  return `"${(/^[\s]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
}
/** One row per original grid position, including removed and nonrectangular positions. */
export function createCassetteProjectCsv(value: CassetteProject): string {
  const project = normalizeCassetteProject(value);
  const rows: unknown[][] = [["ID проекта", "Редакция", "ID фасада", "Фасад", "ID панели", "Марка", "Ряд", "Колонка", "X, мм", "Y, мм", "Ширина ячейки лица, мм", "Высота ячейки лица, мм", "Статус", "Количество позиций", "Остаток лица, м²", "Тип", "Толщина, мм", "Покрытие", "Проёмы", "IFC прямоугольник", "IFC X, мм", "IFC Y, мм", "IFC ширина, мм", "IFC высота, мм", "Границы расчёта"]];
  for (const elevation of project.elevations) {
    for (const panel of buildCassetteElevation(elevation, project.id).panels) {
      const rect = panel.coordinationRect;
      rows.push([project.id, project.revision, elevation.id, elevation.name, panel.id, panel.mark, panel.row + 1, panel.column + 1, panel.xMm, panel.yMm, panel.widthMm, panel.heightMm, cassettePanelStatusLabels[panel.status], panel.status === "opening-removed" ? 0 : 1, panel.remainingAreaM2, elevation.panel.type === "open" ? "Открытая" : "Закрытая", elevation.panel.thicknessMm, elevation.panel.finish, panel.openingIds.join(", "), rect ? "Упрощённое лицо; инженерная проверка" : panel.status === "opening-removed" ? "Исключена: проём" : "Исключена: непрямоугольная форма; нужна КД", rect?.xMm ?? "", rect?.yMm ?? "", rect?.widthMm ?? "", rect?.heightMm ?? "", CASSETTE_PROJECT_SCOPE]);
    }
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}
export function createCassetteProjectBrief(value: CassetteProject): string {
  const p = normalizeCassetteProject(value);
  const lines = ["СТАЛЬ ПРОДУКТ · ПРОЕКТ МЕТАЛЛОКАССЕТ", p.name, `ID проекта: ${p.id}`, `Редакция: ${p.revision} · схема JSON: ${p.schemaVersion}`, "", CASSETTE_PROJECT_SCOPE, "", "Координаты: мм; начало в левом нижнем углу каждого фасада. X вправо, Y вверх.", "Шаг сетки = размер лицевой поверхности + соответствующий заданный шов. Сетка начинается с целой ячейки слева снизу. Граница фасада обрезает последнюю ячейку или проходит в шве.", "Размеры и швы — входные данные проекта, не подтверждённый узел конкретного профиля. Изготовление всех позиций требует согласования. Число затронутых ячеек не определяет количество готовых деталей.", "Подсистема, крепёж, доборы и монтаж не рассчитываются. Базовый бюджет ниже рассчитан по этой же ведомости лиц и не является окончательной стоимостью изготовления."];
  const budget = estimateCassetteProjectBudget(p);
  lines.push("", `Базовый ориентир по площади лиц: ≈ ${budget.totalRub} руб.; ${budget.faceAreaM2} м²; ${budget.quantity} позиций с остатком лица.`, budget.assumptions);
  for (const e of p.elevations) {
    const layout = buildCassetteElevation(e, p.id), s = layout.summary;
    lines.push("", `${e.id} · ${e.name}`, `Габариты: ${e.widthMm} × ${e.heightMm} мм`, `Лицо модуля: ${e.panel.faceWidthMm} × ${e.panel.faceHeightMm} мм; шов X/Y: ${e.panel.jointXMm}/${e.panel.jointYMm} мм`, `Тип: ${e.panel.type === "open" ? "открытый" : "закрытый"}; толщина: ${e.panel.thicknessMm} мм; покрытие: ${e.panel.finish}`, `Сетка: ${layout.rows} рядов × ${layout.columns} колонок`, `Целые: ${s.complete}; краевые: ${s.edge}; у проёмов (проверка): ${s.affected}; исключены проёмами: ${s.removed}`, `Позиции с остатком лица: ${s.quantity}; непрямоугольные, исключаемые из IFC: ${s.nonrectangular}`, `Площадь фасада: ${s.elevationAreaM2} м²; проёмы: ${s.openingsAreaM2} м²; фасад за вычетом проёмов: ${s.netElevationAreaM2} м²`, `Остаток лицевых поверхностей: ${s.panelFaceAreaM2} м²; швы вне проёмов: ${s.jointAreaM2} м²`, "Проёмы:", ...e.openings.map(o => `  ${o.id} ${o.name}: X=${o.xMm}; Y=${o.yMm}; ${o.widthMm} × ${o.heightMm} мм`));
    if (!e.openings.length) lines.push("  Не заданы.");
    lines.push("Ведомость (полные данные также в CSV):", ...layout.panels.map(panel => `  ${panel.mark} | ${panel.id} | ${panel.widthMm} × ${panel.heightMm} мм | ${cassettePanelStatusLabels[panel.status]} | остаток ${panel.remainingAreaM2} м²${panel.status === "opening-affected" && !panel.coordinationRect ? " | IFC: исключена, нужна КД" : ""}`));
  }
  lines.push("", "Для инженерной проверки: узлы примыканий и замков; раскрой и борта; непрямоугольные позиции; фактические зазоры; цвет и покрытие; допуски; маркировка и комплектность. Прикладывайте JSON, CSV и исходные чертежи к обращению самостоятельно. Файлы не отправляются автоматически.");
  return lines.join("\n");
}
