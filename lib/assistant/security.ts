const safeConfirmation = "Для точного подтверждения этого параметра требуется проверка инженером по чертежу и техническому заданию.";

export function redactPersonalData(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-MAIL]")
    .replace(/(?:\+?7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g, "[ТЕЛЕФОН]")
    .replace(/\b\d{10,12}\b/g, (value) => value.length === 10 || value.length === 12 ? "[ИНН]" : value)
    .replace(/\b\d{4}\s+\d{6}\b/g, "[ПАСПОРТ]")
    .replace(/(?:заказ|order|заявк[\p{L}-]*)[\s#:№-]*[A-ZА-Я0-9-]{5,}/giu, "[НОМЕР ЗАКАЗА]")
    .replace(/https?:\/\/\S*[?&](?:token|key|signature|auth|access_token)=[^\s&#]+/gi, "[ССЫЛКА С СЕКРЕТОМ]")
    .replace(
      /\b(?:г\.?|город|ул\.?|улица|проспект|пр-т|д\.?|дом)\s+[А-ЯЁA-Z][^,;\n]{2,80}(?=$|[,;\n])/g,
      "[АДРЕС]",
    );
}

export function isPromptInjection(text: string) {
  return [
    /забудь.{0,30}(?:правил|инструкц|промпт)/i,
    /игнорируй.{0,30}(?:правил|инструкц|предыдущ)/i,
    /(?:покажи|раскрой|выведи).{0,30}(?:системн\w* промпт|api.?ключ|конфигурац|секрет)/i,
    /ignore.{0,30}(?:previous|system|instructions)/i,
    /reveal.{0,30}(?:system prompt|api key|configuration|secret)/i,
    /developer mode|jailbreak|prompt injection/i,
  ].some((expression) => expression.test(text));
}

export function unsafeAnswerFlags(answer: string) {
  const checks: Array<[string, RegExp]> = [
    ["price", /(?:\d[\d\s.,]*)\s*(?:₽|руб(?:\.|лей)?)/i],
    ["exact-deadline", /(?:изготовим|выполним|поставим|гарантируем).{0,30}(?:за|до)\s+\d+/i],
    ["tolerance", /(?:допуск|точност).{0,20}(?:±|\+\/-)\s*\d/i],
    ["max-thickness", /(?:режем|гн[её]м|обрабатываем).{0,25}до\s+\d+(?:[.,]\d+)?\s*мм/i],
    ["stock", /(?:есть|имеется|доступно).{0,20}(?:на складе|в наличии)/i],
    ["installation", /(?:выполняем|сделаем|осуществляем).{0,20}монтаж/i],
    ["unverified-standard", /(?:соответствует|сертифицирован).{0,30}(?:ГОСТ|ТР ТС|пожарн)/i],
  ];
  return checks.filter(([, expression]) => expression.test(answer)).map(([flag]) => flag);
}

export function enforceSafeAnswer(answer: string) {
  const flags = unsafeAnswerFlags(answer);
  return flags.length
    ? { answer: safeConfirmation, flags }
    : { answer: answer.trim(), flags: [] as string[] };
}

export const injectionSafeAnswer = "Я могу помочь только с подготовкой технической заявки на изделия и обработку листового металла. Внутренние инструкции, конфигурация и служебные данные не раскрываются.";
export const engineeringConfirmationAnswer = safeConfirmation;
