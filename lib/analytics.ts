type EventParams = Record<string, string | number | boolean | undefined>;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (command: "event", eventName: string, params?: EventParams) => void;
  ym?: (counterId: number, command: "reachGoal", target: string, params?: EventParams) => void;
};

const yandexGoalByEvent: Record<string, string> = {
  quote_form_started: "quote_form_started",
  quote_file_attached: "quote_file_attached",
  quote_request_submit: "quote_request_submit",
  quote_request_success: "quote_request_success",
  catalog_download: "catalog_download",
  quote_files_cta_click: "quote_files_cta_click",
  email_click: "email_click",
};

export function trackLeadEvent(eventName: string, params: EventParams = {}) {
  if (typeof window === "undefined") return;
  const analyticsWindow = window as AnalyticsWindow;
  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.dataLayer.push({ event: eventName, ...params });
  analyticsWindow.gtag?.("event", eventName, params);

  const yandexCounterId = Number(process.env.NEXT_PUBLIC_YM_COUNTER_ID);
  const yandexGoal = yandexGoalByEvent[eventName];
  if (Number.isFinite(yandexCounterId) && yandexCounterId > 0 && yandexGoal) {
    analyticsWindow.ym?.(yandexCounterId, "reachGoal", yandexGoal, params);
  }
}
