import { basketAcDimensionDisclaimer } from "./basket-ac-reference";
import type { BasketBrief } from "./basket-brief";
import { requiredBasketSpace, type BasketFit } from "./basket-fit";
import { basketMountingDimensions } from "./basket-mounting";

/** Customer-supplied coordination data. Never a verified equipment catalogue. */
export const basketServiceSides = { unknown: "Нужно уточнить", front: "Спереди", left: "Слева", right: "Справа", top: "Сверху" } as const;
export const basketAccessMethods = { unknown: "Нужно уточнить", "remove-front": "Снятие передней панели", "remove-side": "Снятие боковой панели", "open-top": "Через открытый верх" } as const;
export const basketReviewTextLimits = { mark: 80, equipment: 160, clearanceSource: 240, facadeNotes: 500 } as const;
export type BasketCustomerReview = {
  version: 1;
  mark: string;
  equipment: string;
  clearanceSource: string;
  facadeNotes: string;
  serviceSide: keyof typeof basketServiceSides;
  accessMethod: keyof typeof basketAccessMethods;
  requiredServiceMm: number | null;
  availableServiceMm: number | null;
};
export function defaultBasketReview(): BasketCustomerReview {
  return { version: 1, mark: "", equipment: "", clearanceSource: "", facadeNotes: "", serviceSide: "unknown", accessMethod: "unknown", requiredServiceMm: null, availableServiceMm: null };
}
export function validBasketReview(value: unknown): value is BasketCustomerReview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as BasketCustomerReview;
  return v.version === 1 && Object.hasOwn(basketServiceSides, v.serviceSide) && Object.hasOwn(basketAccessMethods, v.accessMethod)
    && (Object.keys(basketReviewTextLimits) as (keyof typeof basketReviewTextLimits)[]).every(key => typeof v[key] === "string" && v[key].length <= basketReviewTextLimits[key] && !/[\u0000-\u001f\u007f]/.test(v[key]))
    && [v.requiredServiceMm, v.availableServiceMm].every(n => n === null || typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 10000);
}
/** Whitelist on import. User-provided prices, approvals and catalogue claims cannot propagate. */
export function cleanBasketReview(value: BasketCustomerReview): BasketCustomerReview {
  if (!validBasketReview(value)) throw Error("Проверьте модель, сервисный доступ и примечания позиции.");
  const { version, mark, equipment, clearanceSource, facadeNotes, serviceSide, accessMethod, requiredServiceMm, availableServiceMm } = value;
  return { version, mark, equipment, clearanceSource, facadeNotes, serviceSide, accessMethod, requiredServiceMm, availableServiceMm };
}
export type BasketReviewCheck = { id: string; title: string; detail: string; state: "supplied" | "missing" | "conflict" | "review"; step: number };
const mm = (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) ? `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} мм` : "неизвестно";

/** Axis-aligned coordination geometry; z starts at the outer facade face.
 * No panel thickness, airflow coefficient, anchors or support capacity is inferred. */
export function basketClearanceGeometry(input: BasketBrief) {
  const envelope = requiredBasketSpace(input.design?.fit);
  const fit = input.design?.fit;
  if (!envelope || !fit || ![input.width, input.height, input.depth].every(n => Number.isFinite(n) && n > 0 && n <= 10000) || Object.values(envelope).some(n => n > 10000)) return null;
  const axes = ([ ["width", "Ширина"], ["height", "Высота"], ["depth", "Глубина"] ] as const).map(([key, label]) => ({ key, label, requiredMm: envelope[key], selectedMm: input[key], differenceMm: input[key] - envelope[key] }));
  return {
    envelope,
    unit: { width: fit.width!, height: fit.height!, depth: fit.depth!, x: fit.left!, y: fit.top!, z: fit.rear! },
    axes,
    wallToBlockRearMm: input.design ? basketMountingDimensions(input.design).wallToBlockRearMm : null,
    inner: input.design?.sizing === "block",
  };
}
export function basketReview(input: BasketBrief): BasketReviewCheck[] {
  const d = input.design;
  const r = input.review;
  const geometry = basketClearanceGeometry(input);
  const fit = d?.fit;
  const known = (n: number | null | undefined, min = 0) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= 10000;
  const dimensionsKnown = fit && [fit.width, fit.height, fit.depth].every(n => known(n, 1));
  const gaps = (["left", "right", "top", "bottom", "front", "rear"] as (keyof BasketFit)[]).filter(k => !known(fit?.[k]));
  const massKnown = Boolean(d && known(d.mass, .001) && d.mass <= 2000);
  const mounting = d ? basketMountingDimensions(d) : null;
  const serviceKnown = known(r?.requiredServiceMm) && known(r?.availableServiceMm);
  const serviceConflict = serviceKnown && r!.availableServiceMm! < r!.requiredServiceMm!;
  const geometryConflict = geometry && geometry.axes.some(axis => geometry.inner ? axis.selectedMm !== Math.ceil(axis.requiredMm) : axis.differenceMm <= 0);
  return [
    { id: "equipment", title: "Модель наружного блока", state: r?.equipment.trim() ? "supplied" : "missing", detail: r?.equipment.trim() || "Перепишите обозначение из паспорта или с шильдика.", step: 0 },
    { id: "dimensions", title: "Габариты всей установки", state: d?.acReference ? "review" : dimensionsKnown ? "supplied" : "missing", detail: d?.acReference ? basketAcDimensionDisclaimer + ". Исходный пример: " + d.acReference.model + "." : dimensionsKnown ? `${fit!.width} × ${fit!.height} × ${fit!.depth} мм, по данным заказчика.` : "Нужны ширина, высота и глубина с выступающими частями.", step: 0 },
    { id: "clearances", title: "Шесть отступов от блока", state: gaps.length ? "missing" : "supplied", detail: gaps.length ? `Осталось указать отступов: ${gaps.length}. Пустое поле не равно нулю.` : "Числа указаны. Соответствие инструкции проверяет инженер.", step: 0 },
    { id: "clearance-source", title: "Источник требований к зазорам", state: r?.clearanceSource.trim() ? "supplied" : "missing", detail: r?.clearanceSource.trim() || "Укажите документ и страницу. Универсальные зазоры не назначаются.", step: 0 },
    { id: "geometry", title: "Сопоставление объёма и корзины", state: !geometry ? "missing" : geometryConflict ? "conflict" : geometry.inner ? "supplied" : "review", detail: !geometry ? "Для сопоставления нужны корректные габариты и все отступы." : geometryConflict ? "Размер корзины не соответствует требуемому объёму. Проверьте выбранные размеры и зазоры." : geometry.inner ? "Внутренний расчётный объём равен сумме габаритов и отступов с округлением вверх. Наружные размеры уточняются." : "Наружный размер больше требуемого объёма. Внутренний просвет ещё нужно проверить по чертежу.", step: 0 },
    { id: "mass", title: "Масса наружного блока", state: massKnown ? "supplied" : "missing", detail: massKnown ? `${d!.mass} кг, по данным заказчика. Это не расчёт нагрузок.` : "Нужна масса блока из паспорта для подбора опор.", step: 2 },
    { id: "facade", title: "Основание и вынос через фасад", state: mounting && mounting.wallKind !== "unknown" && mounting.wallToBlockRearMm !== null ? "supplied" : "missing", detail: mounting?.wallToBlockRearMm !== null && mounting?.wallToBlockRearMm !== undefined ? `От несущей стены до блока: ${mm(mounting.wallToBlockRearMm)}. Анкеры не подобраны.` : "Уточните основание, глубину фасада и задний зазор.", step: 2 },
    { id: "supports", title: "Опоры наружного блока", state: d?.mount && d.mount !== "unknown" ? "supplied" : "missing", detail: d?.mount === "existing" ? "Указаны существующие кронштейны; пригодность и узел корзины требуют проверки." : d?.mount === "bearing" ? "Запрошены новые несущие кронштейны. Их подбор и стоимость отдельные." : "Укажите, есть ли кронштейны блока или их нужно подобрать.", step: 2 },
    { id: "service-access", title: "Сторона и способ обслуживания", state: r && r.serviceSide !== "unknown" && r.accessMethod !== "unknown" ? "supplied" : "missing", detail: r && r.serviceSide !== "unknown" && r.accessMethod !== "unknown" ? `${basketServiceSides[r.serviceSide]}; ${basketAccessMethods[r.accessMethod].toLowerCase()}. Это пожелание для проверки конструкции.` : "Укажите сторону клапанов и желаемый доступ. Съёмность панелей согласуется по чертежу.", step: 2 },
    { id: "service-space", title: "Свободное место для обслуживания", state: !serviceKnown ? "missing" : serviceConflict ? "conflict" : "supplied", detail: serviceKnown ? `Нужно ${mm(r!.requiredServiceMm)}, на объекте ${mm(r!.availableServiceMm)}.${serviceConflict ? " Места недостаточно." : " Сравнены только указанные вами расстояния."}` : "Укажите требуемое и доступное место с сервисной стороны, отдельно от воздушных зазоров.", step: 2 },
    { id: "engineering", title: "Проверка инженером перед изготовлением", state: "review", detail: "Воздухообмен, сервисный доступ, внутренний просвет, съёмность панелей, нагрузки, опоры и анкеры не подтверждены этим подбором.", step: 3 },
  ];
}
export function basketReviewSummary(review: BasketCustomerReview) {
  const r = cleanBasketReview(review);
  return [
    "ДОПОЛНЕНИЯ ЗАКАЗЧИКА — не подтверждены производителем.",
    `Марка / зона: ${r.mark.trim() || "не указана"}.`,
    `Модель наружного блока: ${r.equipment.trim() || "не указана"}.`,
    `Источник требований к зазорам: ${r.clearanceSource.trim() || "не указан"}.`,
    `Обслуживание: ${basketServiceSides[r.serviceSide]}; пожелание по доступу: ${basketAccessMethods[r.accessMethod]}.`,
    `Свободное место с сервисной стороны: требуется ${mm(r.requiredServiceMm)}, доступно ${mm(r.availableServiceMm)}. Это отдельный размер, не добавляемый к воздушным зазорам.`,
    `Примечание по фасаду / трассам: ${r.facadeNotes.trim() || "не указано"}.`,
    "Возможность снятия панелей и доступа к клапанам согласуется по рабочему чертежу. Параметры не подтверждают вентиляцию, несущую способность или подбор анкеров.",
  ].join("\n");
}
