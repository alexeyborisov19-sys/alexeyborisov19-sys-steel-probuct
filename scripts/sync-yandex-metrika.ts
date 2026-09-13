import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CANONICAL_YANDEX_COUNTER_ID, yandexGoalByEvent } from "../lib/analytics";

type GoalMetadata = {
  name: string;
  favorite?: boolean;
};

type GoalCondition = {
  type?: string;
  url?: string;
};

type ExistingGoal = {
  id?: number;
  name?: string;
  type?: string;
  status?: string;
  conditions?: GoalCondition[];
};

type GoalsResponse = {
  goals?: ExistingGoal[];
};

export const METRIKA_GOAL_METADATA: Record<string, GoalMetadata> = {
  "ym-open-leadform": { name: "Форма заявки — открыта" },
  quote_form_started: { name: "Форма заявки — начало заполнения" },
  quote_file_attached: { name: "Форма заявки — файл приложен" },
  quote_request_submit: { name: "Форма заявки — отправка" },
  "ym-submit-leadform": { name: "Форма заявки — успешно отправлена (Яндекс)", favorite: true },
  quote_request_success: { name: "Форма заявки — успешно отправлена", favorite: true },
  quote_request_error: { name: "Форма заявки — ошибка отправки" },
  catalog_download: { name: "Каталог — скачивание" },
  quote_files_cta_click: { name: "Заявка с файлами — CTA" },
  "ym-show-contacts": { name: "Контакты — показ/переход (Яндекс)" },
  email_click: { name: "Контакты — e-mail" },
  exhibition_official_click: { name: "Выставки — официальный сайт" },
  exhibition_quote_click: { name: "Выставки — запрос расчёта" },
  assistant_opened: { name: "Инженерный помощник — открыт" },
  assistant_question: { name: "Инженерный помощник — вопрос" },
  assistant_lead_form_opened: { name: "Инженерный помощник — форма лида открыта" },
  assistant_lead_submit: { name: "Инженерный помощник — отправка лида" },
  assistant_lead_success: { name: "Инженерный помощник — лид получен", favorite: true },
  assistant_lead_error: { name: "Инженерный помощник — ошибка лида" },
};

export function collectDesiredTargets() {
  return [...new Set(Object.values(yandexGoalByEvent).flat())].sort();
}

function actionTarget(goal: ExistingGoal) {
  if (goal.type !== "action") return null;
  const exactCondition = goal.conditions?.find(
    (condition) => condition.type === "exact" && typeof condition.url === "string",
  );
  return exactCondition?.url ?? null;
}

function assertConfigurationIsComplete() {
  const desiredTargets = collectDesiredTargets();
  const metadataTargets = Object.keys(METRIKA_GOAL_METADATA).sort();
  if (JSON.stringify(desiredTargets) !== JSON.stringify(metadataTargets)) {
    const missing = desiredTargets.filter((target) => !METRIKA_GOAL_METADATA[target]);
    const extra = metadataTargets.filter((target) => !desiredTargets.includes(target));
    throw new Error(
      `Metrika goal metadata is out of sync with site events. Missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`,
    );
  }
}

async function apiRequest<T>(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://api-metrika.yandex.net${path}`, {
    ...init,
    headers: {
      Authorization: `OAuth ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Yandex Metrika API ${response.status}: ${text.slice(0, 1000)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function listGoals(token: string) {
  const result = await apiRequest<GoalsResponse>(
    `/management/v1/counter/${CANONICAL_YANDEX_COUNTER_ID}/goals`,
    token,
  );
  return result.goals ?? [];
}

async function createActionGoal(token: string, target: string, metadata: GoalMetadata) {
  await apiRequest(
    `/management/v1/counter/${CANONICAL_YANDEX_COUNTER_ID}/goals`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        goal: {
          name: metadata.name,
          type: "action",
          is_favorite: Boolean(metadata.favorite),
          conditions: [{ type: "exact", url: target }],
        },
      }),
    },
  );
}

function writeGithubSummary(lines: string[]) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  appendFileSync(summaryFile, `${lines.join("\n")}\n`, "utf8");
}

export async function syncYandexMetrikaGoals(token: string) {
  assertConfigurationIsComplete();
  if (!token.trim()) throw new Error("YANDEX_METRIKA_OAUTH_TOKEN is empty");

  const desiredTargets = collectDesiredTargets();
  const before = await listGoals(token);
  const existingByTarget = new Map<string, ExistingGoal>();
  const existingByName = new Map<string, ExistingGoal>();

  for (const goal of before) {
    const target = actionTarget(goal);
    if (target) existingByTarget.set(target, goal);
    if (goal.name) existingByName.set(goal.name, goal);
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const target of desiredTargets) {
    const metadata = METRIKA_GOAL_METADATA[target];
    if (existingByTarget.has(target)) {
      skipped.push(target);
      continue;
    }

    const sameName = existingByName.get(metadata.name);
    if (sameName) {
      const currentTarget = actionTarget(sameName);
      throw new Error(
        `Refusing to create ${target}: goal name "${metadata.name}" already exists with target ${currentTarget ?? "<non-action goal>"}.`,
      );
    }

    await createActionGoal(token, target, metadata);
    created.push(target);
  }

  const after = await listGoals(token);
  const activeTargets = new Set(after.map(actionTarget).filter((value): value is string => Boolean(value)));
  const missingAfterSync = desiredTargets.filter((target) => !activeTargets.has(target));
  if (missingAfterSync.length) {
    throw new Error(`Metrika sync verification failed. Missing goals: ${missingAfterSync.join(", ")}`);
  }

  const summary = [
    "## Yandex Metrika goal sync",
    "",
    `Counter: **${CANONICAL_YANDEX_COUNTER_ID}**`,
    `Required JS goals: **${desiredTargets.length}**`,
    `Created now: **${created.length}**`,
    `Already present: **${skipped.length}**`,
    "",
    "Primary Direct optimization goal: `quote_request_success`.",
    "Secondary successful assistant lead: `assistant_lead_success`.",
    "No existing goals were deleted or modified.",
  ];
  writeGithubSummary(summary);

  console.log(`Counter ${CANONICAL_YANDEX_COUNTER_ID}: ${desiredTargets.length} required goals.`);
  console.log(`Created ${created.length}: ${created.join(", ") || "none"}`);
  console.log(`Already present ${skipped.length}: ${skipped.join(", ") || "none"}`);
  console.log("Verification passed. Existing goals were not deleted or modified.");

  return { created, skipped, total: desiredTargets.length };
}

async function main() {
  const token = process.env.YANDEX_METRIKA_OAUTH_TOKEN ?? "";
  await syncYandexMetrikaGoals(token);
}

const executedDirectly = Boolean(
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href,
);

if (executedDirectly) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Yandex Metrika sync failed: ${message}`);
    process.exitCode = 1;
  });
}
