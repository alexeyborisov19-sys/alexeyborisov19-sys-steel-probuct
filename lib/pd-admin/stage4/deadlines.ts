import { PdStage4Error } from "@/lib/pd-admin/stage4/common";

const DAY = 86_400_000;

export function addWeekdays(value: string, weekdays: number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !Number.isSafeInteger(weekdays) || weekdays < 0) throw new PdStage4Error("VALIDATION_ERROR");
  let remaining = weekdays;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.toISOString();
}

export function defaultSubjectDueAt(receivedAt: string, requestType: string) {
  if (["ACCESS", "PROCESSING_INFORMATION"].includes(requestType)) return addWeekdays(receivedAt, 10);
  if (["CLARIFICATION", "DELETION"].includes(requestType)) return addWeekdays(receivedAt, 7);
  if (requestType === "CONSENT_WITHDRAWAL") return new Date(Date.parse(receivedAt) + 30 * DAY).toISOString();
  return null;
}

export function defaultAuthorityDueAt(receivedAt: string, authorityName: string) {
  return /роскомнадзор|федеральн\S* служб\S* по надзору в сфере связи/i.test(authorityName)
    ? addWeekdays(receivedAt, 10)
    : null;
}

export function assertFiveWeekdayExtension(currentDueAt: string, proposedDueAt: string) {
  if (Date.parse(proposedDueAt) > Date.parse(addWeekdays(currentDueAt, 5))) throw new PdStage4Error("VALIDATION_ERROR");
}
