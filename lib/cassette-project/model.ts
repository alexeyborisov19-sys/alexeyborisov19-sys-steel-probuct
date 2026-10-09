/** Millimetre face-layout model. Application bounds are not manufacturing limits. */
export const CASSETTE_PROJECT_LIMITS = { elevations: 20, openings: 40, cellsPerElevation: 2000, cellsPerProject: 10000, dimensionMm: 1000000, fileBytes: 1000000 } as const;
export const CASSETTE_PROJECT_SCOPE = "Координационная раскладка лицевых поверхностей; не разрешение на изготовление. Подсистема, крепёж, откосы, угловые элементы и монтаж не входят. Размеры бортов, развёртки, замковые узлы, допустимые размеры и нагрузочные расчёты проверяет инженер.";
export type CassetteRect = { xMm: number; yMm: number; widthMm: number; heightMm: number };
export type CassetteOpening = CassetteRect & { id: string; name: string };
export type CassetteElevation = {
  id: string; name: string; widthMm: number; heightMm: number;
  panel: { faceWidthMm: number; faceHeightMm: number; jointXMm: number; jointYMm: number; type: "open" | "closed"; thicknessMm: number; finish: string };
  openings: CassetteOpening[];
};
export type CassetteProject = { schemaVersion: 1; kind: "steelprodukt-cassette-project"; id: string; revision: number; name: string; elevations: CassetteElevation[] };
export type CassettePanelStatus = "complete" | "edge" | "opening-affected" | "opening-removed";
export type CassettePanel = CassetteRect & {
  id: string; mark: string; row: number; column: number; status: CassettePanelStatus;
  faceAreaM2: number; remainingAreaM2: number; openingIds: string[];
  /** Only a genuine rectangular remainder. Null means removed or nonrectangular, never a fabricated bounding panel. */
  coordinationRect: CassetteRect | null;
  remainingRects: CassetteRect[];
};
export type CassetteElevationSummary = {
  quantity: number; complete: number; edge: number; affected: number; removed: number; nonrectangular: number; rectangularCoordination: number;
  elevationAreaM2: number; openingsAreaM2: number; netElevationAreaM2: number; grossPanelFaceAreaM2: number; panelFaceAreaM2: number; jointAreaM2: number;
};
export type CassetteElevationLayout = { rows: number; columns: number; panels: CassettePanel[]; summary: CassetteElevationSummary };
export const cassettePanelStatusLabels: Record<CassettePanelStatus, string> = {
  complete: "Целая", edge: "Краевая", "opening-affected": "У проёма · проверка", "opening-removed": "В проёме · исключена",
};
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const identifier = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v);
const label = (v: unknown, max = 80): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const measurement = (v: unknown, zero = false): v is number => typeof v === "number" && Number.isFinite(v) && (zero ? v >= 0 : v >= .001) && v <= CASSETTE_PROJECT_LIMITS.dimensionMm && Math.abs(v * 1000 - Math.round(v * 1000)) < .0001;
const round = (v: number) => Number(v.toFixed(12));
const rectArea = (r: CassetteRect) => r.widthMm * r.heightMm;
function intersect(a: CassetteRect, b: CassetteRect): CassetteRect | null {
  const xMm = Math.max(a.xMm, b.xMm), yMm = Math.max(a.yMm, b.yMm);
  const widthMm = Math.min(a.xMm + a.widthMm, b.xMm + b.widthMm) - xMm;
  const heightMm = Math.min(a.yMm + a.heightMm, b.yMm + b.heightMm) - yMm;
  return widthMm > .0000001 && heightMm > .0000001 ? { xMm, yMm, widthMm: round(widthMm), heightMm: round(heightMm) } : null;
}
function dimensions(e: CassetteElevation) {
  // A facade may end within a joint. Do not create zero-width slivers inside that joint.
  return { columns: Math.ceil(round(e.widthMm / (e.panel.faceWidthMm + e.panel.jointXMm))), rows: Math.ceil(round(e.heightMm / (e.panel.faceHeightMm + e.panel.jointYMm))) };
}
export function validateCassetteElevation(value: unknown): string[] {
  if (!object(value)) return ["Некорректный фасад."];
  const errors: string[] = [];
  if (!identifier(value.id)) errors.push("Некорректный идентификатор фасада.");
  if (!label(value.name)) errors.push("Название фасада: от 1 до 80 символов без управляющих знаков.");
  if (!measurement(value.widthMm) || !measurement(value.heightMm)) errors.push("Габариты фасада: положительные размеры до 1 000 000 мм, точность до 0,001 мм (границы редактора).");
  const p = value.panel;
  if (!object(p)) errors.push("Не заданы параметры кассеты.");
  else {
    if (!measurement(p.faceWidthMm) || !measurement(p.faceHeightMm)) errors.push("Размеры лица: положительные значения до 1 000 000 мм, точность до 0,001 мм (границы редактора).");
    if (!measurement(p.jointXMm, true) || !measurement(p.jointYMm, true)) errors.push("Швы: неотрицательные значения до 1 000 000 мм, точность до 0,001 мм (границы редактора).");
    if (p.type !== "open" && p.type !== "closed") errors.push("Выберите открытый или закрытый тип кассеты.");
    if (typeof p.thicknessMm !== "number" || ![.65, .7, 1, 1.2].includes(p.thicknessMm)) errors.push("Выберите толщину 0,65; 0,7; 1,0 или 1,2 мм.");
    if (!label(p.finish, 120)) errors.push("Покрытие: от 1 до 120 символов без управляющих знаков.");
  }
  if (!Array.isArray(value.openings) || value.openings.length > CASSETTE_PROJECT_LIMITS.openings) errors.push(`На фасаде допускается до ${CASSETTE_PROJECT_LIMITS.openings} проёмов (граница редактора).`);
  else {
    const ids = new Set<string>();
    const openings: CassetteOpening[] = [];
    value.openings.forEach((opening, index) => {
      const prefix = `Проём ${index + 1}: `;
      if (!object(opening)) { errors.push(`${prefix}некорректные данные.`); return; }
      if (!identifier(opening.id) || ids.has(opening.id)) errors.push(`${prefix}идентификатор должен быть корректным и уникальным.`);
      else ids.add(opening.id);
      if (!label(opening.name)) errors.push(`${prefix}название от 1 до 80 символов.`);
      if (!measurement(opening.xMm, true) || !measurement(opening.yMm, true) || !measurement(opening.widthMm) || !measurement(opening.heightMm)) { errors.push(`${prefix}проверьте положительные размеры и неотрицательные координаты, точность до 0,001 мм.`); return; }
      if (typeof value.widthMm === "number" && typeof value.heightMm === "number" && (round(opening.xMm + opening.widthMm) > value.widthMm || round(opening.yMm + opening.heightMm) > value.heightMm)) errors.push(`${prefix}выходит за границы фасада.`);
      openings.push(opening as CassetteOpening);
    });
    for (let a = 0; a < openings.length; a++) for (let b = a + 1; b < openings.length; b++) {
      if (intersect(openings[a], openings[b])) errors.push(`Проёмы «${openings[a].name}» и «${openings[b].name}» пересекаются. Разделите их; касание границ допустимо.`);
    }
  }
  if (!errors.length) {
    const { rows, columns } = dimensions(value as CassetteElevation);
    if (rows * columns > CASSETTE_PROJECT_LIMITS.cellsPerElevation) errors.push(`Раскладка превышает ${CASSETTE_PROJECT_LIMITS.cellsPerElevation} ячеек на фасад. Укрупните модуль или разделите фасад (граница редактора, не производства).`);
  }
  return errors;
}
export function validateCassetteProject(value: unknown): string[] {
  if (!object(value)) return ["Некорректный файл проекта."];
  const errors: string[] = [];
  if (value.kind !== "steelprodukt-cassette-project" || value.schemaVersion !== 1) errors.push("Этот формат или версия проекта не поддерживается.");
  if (!identifier(value.id)) errors.push("Некорректный идентификатор проекта.");
  if (!Number.isInteger(value.revision) || (value.revision as number) < 1 || (value.revision as number) > 1000000000) errors.push("Некорректная редакция проекта.");
  if (!label(value.name)) errors.push("Название проекта: от 1 до 80 символов без управляющих знаков.");
  if (!Array.isArray(value.elevations) || value.elevations.length < 1 || value.elevations.length > CASSETTE_PROJECT_LIMITS.elevations) errors.push(`В проекте должно быть от 1 до ${CASSETTE_PROJECT_LIMITS.elevations} фасадов.`);
  else {
    const ids = new Set<unknown>(); let totalCells = 0;
    value.elevations.forEach((e, i) => {
      const localErrors = validateCassetteElevation(e);
      errors.push(...localErrors.map(message => `Фасад ${i + 1}: ${message}`));
      if (object(e)) {
        if (ids.has(e.id)) errors.push("Идентификаторы фасадов должны быть уникальными.");
        ids.add(e.id);
      }
      if (!localErrors.length) { const d = dimensions(e as CassetteElevation); totalCells += d.rows * d.columns; }
    });
    if (totalCells > CASSETTE_PROJECT_LIMITS.cellsPerProject) errors.push(`В проекте больше ${CASSETTE_PROJECT_LIMITS.cellsPerProject} ячеек (граница редактора).`);
  }
  return errors;
}
/** Reconstruct known input fields; imported results, prices and approval flags are never trusted. */
export function normalizeCassetteProject(value: unknown): CassetteProject {
  const errors = validateCassetteProject(value); if (errors.length) throw new Error(errors.join(" "));
  const p = value as CassetteProject;
  return { kind: "steelprodukt-cassette-project", schemaVersion: 1, id: p.id, revision: p.revision, name: p.name,
    elevations: p.elevations.map(e => ({ id: e.id, name: e.name, widthMm: e.widthMm, heightMm: e.heightMm,
      panel: { faceWidthMm: e.panel.faceWidthMm, faceHeightMm: e.panel.faceHeightMm, jointXMm: e.panel.jointXMm, jointYMm: e.panel.jointYMm, type: e.panel.type, thicknessMm: e.panel.thicknessMm, finish: e.panel.finish },
      openings: e.openings.map(o => ({ id: o.id, name: o.name, xMm: o.xMm, yMm: o.yMm, widthMm: o.widthMm, heightMm: o.heightMm })),
    })),
  };
}
export function createCassetteElevation(id: string, name = "Фасад 1"): CassetteElevation {
  return { id, name, widthMm: 6000, heightMm: 3000, panel: { faceWidthMm: 1170, faceHeightMm: 545, jointXMm: 20, jointYMm: 20, type: "open", thicknessMm: .7, finish: "По проекту" }, openings: [] };
}
export function createCassetteProject(id: string): CassetteProject {
  return { kind: "steelprodukt-cassette-project", schemaVersion: 1, id, revision: 1, name: "Проект металлокассет", elevations: [createCassetteElevation("E1")] };
}
function subtract(rect: CassetteRect, opening: CassetteRect): CassetteRect[] {
  const cut = intersect(rect, opening); if (!cut) return [rect];
  const right = rect.xMm + rect.widthMm, top = rect.yMm + rect.heightMm;
  return [
    { xMm: rect.xMm, yMm: rect.yMm, widthMm: cut.xMm - rect.xMm, heightMm: rect.heightMm },
    { xMm: cut.xMm + cut.widthMm, yMm: rect.yMm, widthMm: right - cut.xMm - cut.widthMm, heightMm: rect.heightMm },
    { xMm: cut.xMm, yMm: rect.yMm, widthMm: cut.widthMm, heightMm: cut.yMm - rect.yMm },
    { xMm: cut.xMm, yMm: cut.yMm + cut.heightMm, widthMm: cut.widthMm, heightMm: top - cut.yMm - cut.heightMm },
  ].filter(r => r.widthMm > .0000001 && r.heightMm > .0000001).map(r => ({ xMm: round(r.xMm), yMm: round(r.yMm), widthMm: round(r.widthMm), heightMm: round(r.heightMm) }));
}
export function buildCassetteElevation(e: CassetteElevation, projectId: string): CassetteElevationLayout {
  const errors = validateCassetteElevation(e); if (!identifier(projectId)) errors.push("Некорректный идентификатор проекта.");
  if (errors.length) throw new Error(errors.join(" "));
  const { rows, columns } = dimensions(e), panels: CassettePanel[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const xMm = round(column * (e.panel.faceWidthMm + e.panel.jointXMm)), yMm = round(row * (e.panel.faceHeightMm + e.panel.jointYMm));
    const widthMm = round(Math.min(e.panel.faceWidthMm, e.widthMm - xMm)), heightMm = round(Math.min(e.panel.faceHeightMm, e.heightMm - yMm));
    const rect = { xMm, yMm, widthMm, heightMm };
    const affecting = e.openings.filter(o => intersect(rect, o));
    const remainingRects = affecting.reduce((parts, opening) => parts.flatMap(part => subtract(part, opening)), [rect]);
    const remainingArea = remainingRects.reduce((sum, r) => sum + rectArea(r), 0);
    let coordinationRect: CassetteRect | null = null;
    if (remainingRects.length) {
      const left = Math.min(...remainingRects.map(r => r.xMm)), bottom = Math.min(...remainingRects.map(r => r.yMm));
      const bounds = { xMm: left, yMm: bottom, widthMm: round(Math.max(...remainingRects.map(r => r.xMm + r.widthMm)) - left), heightMm: round(Math.max(...remainingRects.map(r => r.yMm + r.heightMm)) - bottom) };
      // Every accepted coordinate is quantized to 0.001 mm. Exact integer-area comparison
      // prevents small holes in a large face from being hidden by a relative tolerance.
      const exactArea = (r: CassetteRect) => BigInt(Math.round(r.widthMm * 1000)) * BigInt(Math.round(r.heightMm * 1000));
      if (exactArea(bounds) === remainingRects.reduce((sum, r) => sum + exactArea(r), BigInt(0))) coordinationRect = bounds;
    }
    const status: CassettePanelStatus = !remainingRects.length ? "opening-removed" : affecting.length ? "opening-affected" : widthMm < e.panel.faceWidthMm || heightMm < e.panel.faceHeightMm ? "edge" : "complete";
    panels.push({ ...rect, id: `${projectId}/${e.id}/r${row + 1}c${column + 1}`, mark: `${e.id}-R${String(row + 1).padStart(2, "0")}-C${String(column + 1).padStart(2, "0")}`, row, column, status, faceAreaM2: round(rectArea(rect) / 1e6), remainingAreaM2: round(remainingArea / 1e6), openingIds: affecting.map(o => o.id), coordinationRect, remainingRects });
  }
  const count = (status: CassettePanelStatus) => panels.filter(p => p.status === status).length;
  const elevationAreaM2 = round(e.widthMm * e.heightMm / 1e6), openingsAreaM2 = round(e.openings.reduce((sum, o) => sum + rectArea(o), 0) / 1e6);
  const panelFaceAreaM2 = round(panels.reduce((sum, p) => sum + p.remainingAreaM2, 0)), netElevationAreaM2 = round(elevationAreaM2 - openingsAreaM2);
  return { rows, columns, panels, summary: { quantity: panels.length - count("opening-removed"), complete: count("complete"), edge: count("edge"), affected: count("opening-affected"), removed: count("opening-removed"), nonrectangular: panels.filter(p => p.status === "opening-affected" && !p.coordinationRect).length, rectangularCoordination: panels.filter(p => p.coordinationRect).length,
    elevationAreaM2, openingsAreaM2, netElevationAreaM2, grossPanelFaceAreaM2: round(panels.reduce((sum, p) => sum + p.faceAreaM2, 0)), panelFaceAreaM2, jointAreaM2: round(Math.max(0, netElevationAreaM2 - panelFaceAreaM2)),
  } };
}
