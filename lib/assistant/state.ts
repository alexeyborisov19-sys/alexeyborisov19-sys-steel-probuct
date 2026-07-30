import type {
  AssistantSession,
  EngineeringField,
  EngineeringLeadState,
  StructuredAssistantResult,
} from "./types";

const requiredSequence: EngineeringField[] = [
  "productType",
  "purpose",
  "quantity",
  "drawingAvailable",
  "material",
  "thickness",
  "coating",
  "deadline",
  "deliveryRegion",
];

const engineeringFields: EngineeringField[] = [
  "productType",
  "purpose",
  "material",
  "thickness",
  "dimensions",
  "quantity",
  "coating",
  "ral",
  "drawingAvailable",
  "fileTypes",
  "deadline",
  "deliveryRegion",
];

const engineeringFieldSet = new Set<EngineeringField>(engineeringFields);

const questions: Record<EngineeringField, string> = {
  productType: "Что именно требуется изготовить?",
  purpose: "Для какого объекта или задачи предназначено изделие?",
  material: "Какой материал предполагается использовать? Если не знаете — так и напишите.",
  thickness: "Какая толщина металла указана в проекте? Если не знаете — так и напишите.",
  dimensions: "Укажите основные габариты изделия, если они известны.",
  quantity: "Какое количество изделий или объём партии требуется?",
  coating: "Требуется ли порошковая окраска или другое покрытие?",
  ral: "Какой цвет RAL нужен, если он уже выбран?",
  drawingAvailable: "Есть чертёж, 3D-модель или хотя бы эскиз изделия?",
  fileTypes: "В каком формате подготовлены исходные файлы?",
  deadline: "К какому сроку требуется поставка?",
  deliveryRegion: "В какой регион планируется поставка?",
};

export function emptyLeadState(): EngineeringLeadState {
  return {
    unknownFields: [],
    missingFields: [...requiredSequence],
    readiness: "new",
  };
}

function setUnknown(state: EngineeringLeadState, field: EngineeringField) {
  if (!state.unknownFields.includes(field)) state.unknownFields.push(field);
}

function hasKnownValue(state: EngineeringLeadState, field: EngineeringField) {
  return state[field] !== undefined || state.unknownFields.includes(field);
}

function match(text: string, expression: RegExp) {
  return text.match(expression)?.[1]?.trim();
}

export function extractLeadState(
  current: EngineeringLeadState,
  message: string,
  lastAskedField?: EngineeringField,
) {
  const state: EngineeringLeadState = {
    ...current,
    unknownFields: [...current.unknownFields],
    missingFields: [...current.missingFields],
  };
  const normalized = message.toLowerCase().replace(/\s+/g, " ").trim();

  if (/^(не знаю|неизвестно|пока не знаю|не определились|нет данных)[.!]?$/i.test(normalized) && lastAskedField) {
    setUnknown(state, lastAskedField);
  }

  const productPatterns: Array<[RegExp, string]> = [
    [/(металлокассет|фасадн[\p{L}-]* кассет)/u, "Металлокассеты"],
    [/(корзин[\p{L}-]* (?:для )?кондиционер)/u, "Корзины для кондиционеров"],
    [/(экран[\p{L}-]* (?:для )?кондиционер)/u, "Экраны для кондиционеров"],
    [/(корпус|шкаф|кожух)/, "Промышленный корпус или шкаф"],
    [/(лазерн[\p{L}-]* резк|раскро)/u, "Лазерный раскрой"],
    [/(гибк[\p{L}-]* (?:метал|детал)|гнут[\p{L}-]* детал)/u, "Гибка деталей"],
    [/(порошков[\p{L}-]* окраск|покраск)/u, "Порошковая окраска"],
    [/(кронштейн)/, "Кронштейны"],
    [/(панел|решетк|решётк|отлив|откос|парапет)/, "Изделия из листового металла"],
  ];
  for (const [pattern, value] of productPatterns) {
    if (pattern.test(normalized)) {
      state.productType = value;
      break;
    }
  }

  const purpose = match(normalized, /(?:для|назначение[:\s]+)\s*([^,.!?]{4,100})/i);
  if (purpose) state.purpose = purpose;

  const materialPatterns: Array<[RegExp, string]> = [
    [/нержавеющ[\p{L}-]*/u, "Нержавеющая сталь"],
    [/оцинкованн[\p{L}-]*/u, "Оцинкованная сталь"],
    [/алюмини[\p{L}-]*/u, "Алюминий"],
    [/черн[\p{L}-]* стал[\p{L}-]*|сталь\s*(?:ст|09г2с|08пс|08кп)\S*/iu, "Сталь"],
  ];
  for (const [pattern, value] of materialPatterns) {
    if (pattern.test(normalized)) {
      state.material = value;
      break;
    }
  }

  const thickness = match(normalized, /(?:толщин[\p{L}-]*\s*)?(\d+(?:[.,]\d+)?)\s*мм(?:\s|$|[,.])/iu);
  if (thickness) state.thickness = `${thickness.replace(",", ".")} мм`;

  const dimensions = match(
    normalized,
    /(\d{2,5}\s*[×xх*]\s*\d{2,5}(?:\s*[×xх*]\s*\d{2,5})?\s*(?:мм|см|м)?)/i,
  );
  if (dimensions) state.dimensions = dimensions.replace(/[xх*]/gi, "×");

  const quantity = match(normalized, /(\d[\d\s]*(?:шт(?:ук)?|единиц|комплект[\p{L}-]*|м²|м2|пог\.?\s*м))/iu);
  if (quantity) state.quantity = quantity.replace(/\s+/g, " ");

  if (/порошков[\p{L}-]* окраск|покрыт|покрас/iu.test(normalized)) state.coating = "Требуется покрытие";
  if (/без (?:покрытия|покраски)|покрытие не нужно/i.test(normalized)) state.coating = "Без покрытия";
  const ral = match(normalized, /\bral\s*[-:]?\s*(\d{4})\b/i);
  if (ral) state.ral = `RAL ${ral}`;

  if (/(?:черт[её]ж|эскиз|3d|модел\w*|dxf|dwg|step).{0,25}(?:есть|имеется|приложу|готов)/i.test(normalized)
    || /(?:есть|имеется|приложу|готов).{0,25}(?:черт[её]ж|эскиз|3d|модел\w*|dxf|dwg|step)/i.test(normalized)) {
    state.drawingAvailable = true;
  }
  if (/(?:нет|без).{0,20}(?:черт[её]ж|эскиз|модел)|черт[её]жа нет/i.test(normalized)) {
    state.drawingAvailable = false;
  }

  const fileTypes = [...normalized.matchAll(/\b(pdf|dxf|dwg|step|stp|iges|igs|sldprt|jpg|png)\b/gi)]
    .map((item) => item[1].toUpperCase());
  if (fileTypes.length) state.fileTypes = [...new Set(fileTypes)];

  const deadline = match(
    normalized,
    /(?:срок|до|к)\s*((?:\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)|(?:\d+\s*(?:дн|недел|месяц)[\p{L}-]*)|(?:конц[\p{L}-]*|начал[\p{L}-]*)\s+[\p{L}-]+)/iu,
  );
  if (deadline) state.deadline = deadline;

  const region = match(
    normalized,
    /(?:доставк[\p{L}-]*|поставк[\p{L}-]*|регион|город)\s*(?:в|до|:)?\s*([\p{L}-]{3,}(?:\s+[\p{L}-]{3,})?)/iu,
  );
  if (region) state.deliveryRegion = region;

  state.missingFields = requiredSequence.filter((field) => !hasKnownValue(state, field));
  state.readiness = state.missingFields.length === 0
    ? "ready_for_lead"
    : Object.keys(state).some((key) => !["unknownFields", "missingFields", "readiness"].includes(key))
      ? "clarifying"
      : "new";
  return state;
}

export function nextQuestionFor(state: EngineeringLeadState) {
  const field = requiredSequence.find((candidate) => !hasKnownValue(state, candidate));
  return field ? { field, question: questions[field] } : undefined;
}

export function structuredLeadSummary(state: EngineeringLeadState) {
  const value = (field: EngineeringField) => {
    const raw = state[field];
    if (raw !== undefined) return Array.isArray(raw) ? raw.join(", ") : String(raw);
    return state.unknownFields.includes(field) ? "клиент не знает" : "не указано";
  };
  return [
    `Изделие: ${value("productType")}`,
    `Назначение: ${value("purpose")}`,
    `Материал: ${value("material")}`,
    `Толщина: ${value("thickness")}`,
    `Габариты: ${value("dimensions")}`,
    `Количество: ${value("quantity")}`,
    `Покрытие: ${value("coating")}`,
    `RAL: ${value("ral")}`,
    `Чертёж: ${state.drawingAvailable === true ? "есть" : state.drawingAvailable === false ? "нет" : value("drawingAvailable")}`,
    `Файлы: ${value("fileTypes")}`,
    `Срок: ${value("deadline")}`,
    `Регион поставки: ${value("deliveryRegion")}`,
  ].join("\n");
}

export function validateStructuredResult(value: unknown): StructuredAssistantResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (typeof result.answer !== "string"
    || typeof result.nextQuestion !== "string"
    || typeof result.readyForLead !== "boolean"
    || !Array.isArray(result.missingFields)
    || !Array.isArray(result.safetyFlags)
    || !result.extractedFields
    || typeof result.extractedFields !== "object"
    || Array.isArray(result.extractedFields)) return null;

  if (!result.missingFields.every((field) => typeof field === "string" && engineeringFieldSet.has(field as EngineeringField))) {
    return null;
  }
  if (!result.safetyFlags.every((flag) => typeof flag === "string")) return null;
  if (result.answer.length > 1800 || result.nextQuestion.length > 500) return null;

  const extractedFields = result.extractedFields as Record<string, unknown>;
  const entries = Object.entries(extractedFields);
  if (entries.length > engineeringFields.length) return null;
  for (const [field, fieldValue] of entries) {
    if (!engineeringFieldSet.has(field as EngineeringField)) return null;
    if (field === "drawingAvailable") {
      if (typeof fieldValue !== "boolean") return null;
      continue;
    }
    if (field === "fileTypes") {
      if (!Array.isArray(fieldValue)
        || fieldValue.length > 10
        || !fieldValue.every((item) => typeof item === "string" && item.length <= 20)) return null;
      continue;
    }
    if (typeof fieldValue !== "string" || fieldValue.length > 300) return null;
  }

  return {
    answer: result.answer.trim(),
    extractedFields: extractedFields as StructuredAssistantResult["extractedFields"],
    missingFields: result.missingFields as EngineeringField[],
    nextQuestion: result.nextQuestion.trim(),
    readyForLead: result.readyForLead,
    safetyFlags: result.safetyFlags as string[],
  };
}

export function modelJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["answer", "extractedFields", "missingFields", "nextQuestion", "readyForLead", "safetyFlags"],
    properties: {
      answer: { type: "string", maxLength: 1800 },
      extractedFields: {
        type: "object",
        additionalProperties: false,
        properties: {
          productType: { type: "string", maxLength: 300 },
          purpose: { type: "string", maxLength: 300 },
          material: { type: "string", maxLength: 300 },
          thickness: { type: "string", maxLength: 300 },
          dimensions: { type: "string", maxLength: 300 },
          quantity: { type: "string", maxLength: 300 },
          coating: { type: "string", maxLength: 300 },
          ral: { type: "string", maxLength: 300 },
          drawingAvailable: { type: "boolean" },
          fileTypes: {
            type: "array",
            maxItems: 10,
            items: { type: "string", maxLength: 20 },
          },
          deadline: { type: "string", maxLength: 300 },
          deliveryRegion: { type: "string", maxLength: 300 },
        },
      },
      missingFields: { type: "array", items: { type: "string", enum: requiredSequence } },
      nextQuestion: { type: "string", maxLength: 500 },
      readyForLead: { type: "boolean" },
      safetyFlags: { type: "array", items: { type: "string" } },
    },
  } as const;
}

export function sessionLeadSummary(session: AssistantSession) {
  return structuredLeadSummary(session.state);
}
