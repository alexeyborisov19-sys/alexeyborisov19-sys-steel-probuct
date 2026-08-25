export const laserCuttingCapabilities = {
  material: "чёрная сталь",
  thicknessRange: "0,5–40 мм",
  maximumThickness: "до 40 мм",
  tableWorkingArea: "1500 × 3000 мм",
} as const;

export const productionEquipment = {
  laserComplexes: 3,
  pressBrakes: 3,
  panelBenders: 1,
  powderCoatingBooths: 3,
  shotBlastingChambers: 1,
  laserCleaningSystems: 1,
} as const;

export const productionOrderConditions = {
  typicalLeadTime: "7–14 дней",
  customerSuppliedMaterial: "работаем с давальческим сырьём",
} as const;

export const laserCuttingTechnicalSummary =
  `Лазерная резка чёрной стали в диапазоне ${laserCuttingCapabilities.thicknessRange}. ` +
  `Рабочее поле стола — ${laserCuttingCapabilities.tableWorkingArea}.`;

export const bendingEquipmentSummary =
  `${productionEquipment.pressBrakes} листогибочных комплекса и панельгиб.`;

export const surfacePreparationSummary =
  "На производстве есть дробеструйная камера и система лазерной очистки. " +
  "Конкретный способ очистки и подготовки поверхности выбираем по материалу, состоянию изделия и следующей технологической операции.";

export const productionLeadTimeSummary =
  `Ориентировочный производственный срок — ${productionOrderConditions.typicalLeadTime} после согласования исходных данных. ` +
  "Фактический срок зависит от загрузки оборудования, объёма партии и состава технологического маршрута.";

export const customerMaterialSummary =
  "Принимаем давальческий материал после входного контроля марки, толщины, габаритов и состояния поверхности. " +
  "Пригодность сырья для выбранной технологии подтверждаем до запуска заказа.";
