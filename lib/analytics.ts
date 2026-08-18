type EventParams = Record<string, string | number | boolean | undefined>;

type AnalyticsWindow = Window & {
  ym?: (counterId: number, command: "reachGoal", target: string, params?: EventParams) => void;
};

// The first identifiers are Yandex's recommended lead-form goals. The second
// identifiers keep detailed B2B funnel reporting available in Metrica.
// Create goals with these exact names in the Metrica interface after adding
// the counter ID to the production environment.
const yandexGoalByEvent: Record<string, string[]> = {
  quote_form_started: ["ym-open-leadform", "quote_form_started"],
  quote_file_attached: ["quote_file_attached"],
  quote_request_submit: ["quote_request_submit"],
  quote_request_success: ["ym-submit-leadform", "quote_request_success"],
  quote_request_error: ["quote_request_error"],
  catalog_download: ["catalog_download"],
  quote_files_cta_click: ["quote_files_cta_click"],
  email_click: ["ym-show-contacts", "email_click"],
  exhibition_official_click: ["exhibition_official_click"],
  exhibition_quote_click: ["exhibition_quote_click"],
  assistant_opened: ["assistant_opened"],
  assistant_question: ["assistant_question"],
  assistant_lead_form_opened: ["assistant_lead_form_opened"],
  assistant_lead_submit: ["assistant_lead_submit"],
  assistant_lead_success: ["ym-submit-leadform", "assistant_lead_success"],
  assistant_lead_error: ["assistant_lead_error"],
};

const sensitiveParameterKey = /(?:^|_)(?:name|email|phone|message|content|filename|file_name|company|contact)(?:_|$)/i;

export function sanitizeAnalyticsParams(params: EventParams) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([key, value]) => !sensitiveParameterKey.test(key) && value !== undefined)
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : value]),
  ) as EventParams;
}

export function createResettableOnce(callback: () => void) {
  let fired = false;
  return {
    fire() {
      if (fired) return;
      fired = true;
      callback();
    },
    reset() {
      fired = false;
    },
  };
}

// The advertising account carries its own counter. Direct optimises campaigns on
// the goals recorded there, so a lead that reaches only the analytics counter is
// invisible to the ad system and the campaign has nothing to learn from. Kept in
// the repository rather than the environment because it is a fixed fact about
// the account, like the IndexNow key.
const advertisingCounterId = 111686322;

/** Every counter the site reports to. Read at call time so tests can swap the environment. */
export function yandexCounterIds() {
  return [Number(process.env.NEXT_PUBLIC_YM_COUNTER_ID), advertisingCounterId]
    .filter((counterId) => Number.isFinite(counterId) && counterId > 0);
}

export function trackLeadEvent(eventName: string, params: EventParams = {}) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as AnalyticsWindow;

  const yandexGoals = yandexGoalByEvent[eventName];
  if (!yandexGoals) return;
  const safeParams = sanitizeAnalyticsParams(params);
  for (const goal of yandexGoals) {
    for (const counterId of yandexCounterIds()) {
      analyticsWindow.ym?.(counterId, "reachGoal", goal, safeParams);
    }
  }
}
