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

export function trackLeadEvent(eventName: string, params: EventParams = {}) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as AnalyticsWindow;

  const yandexCounterId = Number(process.env.NEXT_PUBLIC_YM_COUNTER_ID);
  const yandexGoals = yandexGoalByEvent[eventName];
  if (Number.isFinite(yandexCounterId) && yandexCounterId > 0 && yandexGoals) {
    for (const goal of yandexGoals) {
      analyticsWindow.ym?.(yandexCounterId, "reachGoal", goal, params);
    }
  }
}
