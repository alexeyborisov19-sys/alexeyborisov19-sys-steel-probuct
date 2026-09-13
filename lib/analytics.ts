type EventParams = Record<string, string | number | boolean | undefined>;

type AnalyticsWindow = Window & {
  ym?: (counterId: number, command: "reachGoal", target: string, params?: EventParams) => void;
};

export const YANDEX_METRIKA_COUNTER_ID = 112542227;

// The first identifiers are Yandex's recommended lead-form goals. The second
// identifiers keep detailed B2B funnel reporting available in Metrica.
// Create goals with these exact names in the Metrica interface for counter
// 112542227. Direct must use this same counter rather than a parallel one.
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

/**
 * The public site reports to one canonical Yandex Metrica counter.
 * Keep Direct, site goals and legal disclosures tied to this same ID so a
 * deployment environment cannot accidentally restore an obsolete counter.
 */
export function yandexCounterIds() {
  return [YANDEX_METRIKA_COUNTER_ID];
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
