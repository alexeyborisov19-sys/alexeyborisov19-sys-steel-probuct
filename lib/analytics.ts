type EventParams = Record<string, string | number | boolean | undefined>;

type AnalyticsWindow = Window & {
  ym?: (counterId: number, command: "reachGoal", target: string, params?: EventParams) => void;
};

const yandexGoalByEvent: Record<string, string[]> = {
  quote_form_started: ["ym-open-leadform", "quote_form_started"],
  quote_file_attached: ["quote_file_attached"],
  quote_request_submit: ["quote_request_submit"],
  quote_request_success: ["ym-submit-leadform", "quote_request_success"],
  catalog_download: ["catalog_download"],
  quote_files_cta_click: ["quote_files_cta_click"],
  email_click: ["ym-show-contacts", "email_click"],
};

export function trackLeadEvent(eventName: string, params: EventParams = {}) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as AnalyticsWindow;

  const yandexCounterId = Number(process.env.NEXT_PUBLIC_YM_COUNTER_ID);
  const yandexGoals = yandexGoalByEvent[eventName] ?? [];
  if (Number.isFinite(yandexCounterId) && yandexCounterId > 0 && yandexGoals.length) {
    for (const yandexGoal of yandexGoals) {
      analyticsWindow.ym?.(yandexCounterId, "reachGoal", yandexGoal, params);
    }
  }
}
