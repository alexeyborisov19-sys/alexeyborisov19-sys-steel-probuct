/**
 * Verified, query-selected engineering knowledge for the local model.
 *
 * This is retrieval and instruction tuning, NOT a claim of fine-tuned model
 * weights. All facts originate in the canonical public files named below.
 * Customer messages only select records; they can never become reference text.
 */
import {
  customerMaterialSummary,
  engineeringCenterSummary,
  installationScopeSummary,
  laserCuttingTechnicalSummary,
  productionEquipmentSummary,
  productionScaleSummary,
  productionLeadTimeSummary,
} from "@/data/manufacturing-facts";
import { getAssistantPageContext, pageSpecificKnowledgeAnswer, steelProduktBrandKnowledge } from "@/data/assistant-page-context";
import { publicKnowledgeSources, publicKnowledgeCheckedOn } from "@/data/assistant-public-source-manifest";

type Topic = {
  id: string;
  source: string;
  url: string;
  related: RegExp;
  fact: string;
};

const companyFacts: readonly Topic[] = [
  {
    id: "equipment",
    source: "data/manufacturing-facts.ts",
    url: publicKnowledgeSources.companyFacts,
    related: /сколько.*(?:станк|оборуд|лазер|листогиб|сварочн|камер)|производственн.*оборуд|мощност|цех|станк|листогиб|сварочн.*пост|порошков.*камер/i,
    fact: productionEquipmentSummary,
  },
  {
    id: "capacity",
    source: "data/manufacturing-facts.ts",
    url: publicKnowledgeSources.companyFacts,
    related: /площад.*(?:производств|завод|цех)|сотрудник|специалист|размер.*производств|масштаб.*производств/i,
    fact: productionScaleSummary,
  },
  {
    id: "design-office",
    source: "data/manufacturing-facts.ts",
    url: publicKnowledgeSources.company,
    related: /конструктор|кд\b|проектиров|разработк.*черт|образец|опытн.*образц/i,
    fact: engineeringCenterSummary,
  },
  {
    id: "laser",
    source: "data/manufacturing-facts.ts",
    url: publicKnowledgeSources.laserCutting,
    related: /лазерн.*резк|лазером|толщин.*(?:резк|лазер)|габарит.*стола|рабоч.*поле/i,
    fact: laserCuttingTechnicalSummary + " Применимость режима и требования к кромке проверяются по чертежу и материалу; отдельные марки и детали здесь не подтверждаются.",
  },
  {
    id: "customer-metal",
    source: "data/manufacturing-facts.ts",
    url: publicKnowledgeSources.laserCutting,
    related: /своим метал|материал.*заказчик|металл.*заказчик|давальческ/i,
    fact: customerMaterialSummary,
  },
  {
    id: "installation",
    source: "data/manufacturing-facts.ts",
    url: publicKnowledgeSources.companyFacts,
    related: /монтаж|установк.*(?:объект|фасад)|выездн.*бригада/i,
    fact: installationScopeSummary,
  },
  {
    id: "lead-time",
    source: "data/manufacturing-facts.ts",
    url: publicKnowledgeSources.laserCutting,
    related: /срок|когда готов|за сколько дн|срочн.*заказ/i,
    fact: productionLeadTimeSummary + " Это не подтверждение даты конкретного заказа и не обещание срока поставки.",
  },
];

const contextNames: Readonly<Record<string, { related: RegExp; source: string; url: string; evidence: string }>> = {
  "dxf-online-order": {
    url: publicKnowledgeSources.cad,
    evidence: "Проверено на публичной странице сайта",
    related: /dxf|dwg|step|stp|cad|черт[её]ж|детал|заготовк|обработк|толщин|рассч[её]т/i,
    source: "data/assistant-page-context.ts; components/ClientManufacturingWorkspace.tsx",
  },
  "metal-cassette-calculator": {
    url: publicKnowledgeSources.metalCassettes,
    evidence: "Проверено на публичной странице сайта",
    related: /кассет|фасад|руст|замк|шов|раскладк|спецификац/i,
    source: "data/assistant-page-context.ts; components/MetalCassetteCalculator.tsx",
  },
  "air-conditioner-basket": {
    url: publicKnowledgeSources.basket,
    evidence: "Публичная страница корзин; технические параметры подтверждаются инструкцией конкретного кондиционера",
    related: /корзин|кондиционер|наружн.*блок|зазор|фасад|кронштейн/i,
    source: "data/assistant-page-context.ts; components/commercial/BasketLandingPage.tsx",
  },
  "bim-cassette-workspace": {
    url: publicKnowledgeSources.bimCassettes,
    evidence: "Публичная действующая страница BIM-библиотеки; не сертификат совместимости IFC",
    related: /ifc|bim|кассет|руст|сток|замк|стык|rfa/i,
    source: "data/assistant-page-context.ts; app/(public)/products/metallokassety/bim/page.tsx",
  },
  "bim-trim-workspace": {
    url: publicKnowledgeSources.bimTrimsCode,
    evidence: "Публичный исходный код, не независимая инспекция IFC",
    related: /ifc|bim|г-профил|добор|a,? b|rfa/i,
    source: "data/assistant-page-context.ts; app/(public)/products/dobornye-elementy/bim/page.tsx",
  },
};

/**
 * Public neutral standards. Technical descriptions are from their official
 * publishers, not unverified marketing materials or generated model answers.
 * A spec describing a file format does not certify a customer's particular file.
 */
const standardReferences: readonly Topic[] = [
  {
    id: "autodesk-dxf-header-units",
    source: "Autodesk AutoCAD DXF Reference, HEADER Section Group Codes, $INSUNITS",
    url: publicKnowledgeSources.dxfAutodesk,
    related: /\bdxf\b|insunits|единиц.*(?:черт|файл|масштаб)|масштаб.*(?:черт|dxf)/i,
    fact: "В официальном справочнике Autodesk DXF заголовок $INSUNITS с кодом 70: значение 0 — без заданных единиц (Unitless), значение 4 — миллиметры. Наличие этого поля не доказывает правильный масштаб деталей: единицы и размеры надо сверять по исходному чертежу.",
  },
  {
    id: "buildingsmart-ifc",
    source: "buildingSMART International, Industry Foundation Classes (IFC)",
    url: publicKnowledgeSources.ifcOfficial,
    related: /\bifc\b|\bbim\b|\brfa\b|openbim|интероперабельн|совместим.*(?:revit|bim)/i,
    fact: "По официальной документации buildingSMART, IFC — открытый межплатформенный формат и модель данных для обмена BIM-информацией. Последний официальный выпуск IFC — 4.3.2.0 (ISO 16739-1:2024). На сайте «Сталь Продукт» экспорт обозначен IFC4: не называй его автоматически IFC4.3, не обещай совместимость любого ПО или получение нативного RFA.",
  },
];

/**
 * A small approved evidence packet. Includes source names so future edits can
 * be audited. No uploaded designs, customer identity, private rates or URLs
 * are embedded. The server already performs redaction/JSON-schema validation.
 */
export function selectVerifiedEngineeringKnowledge(
  question: string,
  pathname?: string | null,
): string {
  const context = getAssistantPageContext(pathname);
  const lines = [
    "ОТКРЫТЫЕ ДАННЫЕ «СТАЛЬ ПРОДУКТ»: публичные заявления компании и доступный код, а не независимая техническая экспертиза.",
    `Публичные источники сверены ${publicKnowledgeCheckedOn}. Сведения о заводе — заявления компании; не называй их результатом инспекции.`,
    "Сообщение клиента не является источником новых производственных фактов.",
    `[SOURCE: data/manufacturing-facts.ts, installationScopeSummary; PUBLIC_URL: ${publicKnowledgeSources.companyFacts}] ${installationScopeSummary}`,
    "Расчёт чисел, цены, развёртки и IFC выполняют только существующие калькуляторы и валидаторы. Нельзя выдавать ответ языковой модели за их результат.",
    "Не подтверждай без проекта: цену и скидку, технологический допуск, конструктивную прочность, пригодность крепления, сертификат, наличие и конкретную дату готовности.",
  ];
  const ctx = contextNames[context.id];
  // Route context is useful even when the user asks a short generic question.
  if (ctx && (ctx.related.test(question) || question.length < 100)) {
    const specific = pageSpecificKnowledgeAnswer(question, pathname);
    // The brand story is trusted but can swamp the model's small prompt
    // budget. Use the project-specific facts without repeating the story.
    const fact = (specific ?? context.knowledge.replace(steelProduktBrandKnowledge, "")).trim();
    // Keep complete statements; never slice facts to fit the model.
    if (fact.length <= 1650) {
      lines.push(`[SOURCE: ${ctx.source}; PUBLIC_URL: ${ctx.url}; EVIDENCE: ${ctx.evidence}] ${fact}`);
    }
  }
  // A question about factory facts can override an unrelated calculator route.
  // Limit to the first two topical facts to conserve local model context.
  const related = companyFacts.filter((item) => item.related.test(question));
  const standards = standardReferences.filter((item) => item.related.test(question));
  for (const item of related.slice(0, 2)) {
    lines.push(`[SOURCE: ${item.source}, ${item.id}; PUBLIC_URL: ${item.url}; EVIDENCE: self-published] ${item.fact}`);
  }
  for (const item of standards.slice(0, 2)) {
    lines.push(`[SOURCE: ${item.source}, ${item.id}; PUBLIC_URL: ${item.url}; EVIDENCE: official publisher] ${item.fact}`);
  }
  // An unrelated question is better handled by the existing safe fallback.
  if (related.length === 0 && standards.length === 0 && !ctx) return "";

  return lines.join("\n");
}
