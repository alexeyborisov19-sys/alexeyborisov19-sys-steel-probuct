import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serviceUrl = new URL("../lib/pd-admin/mail/service.ts", import.meta.url);
const listPageUrl = new URL("../app/(internal)/internal/personal-data/mail/page.tsx", import.meta.url);
const detailPageUrl = new URL("../app/(internal)/internal/personal-data/mail/[uid]/page.tsx", import.meta.url);

test("internal mailbox module requires full-lead permission and audits reads", async () => {
  const service = await readFile(serviceUrl, "utf8");
  assert.match(service, /assertPdPermission\(context\.user\.role, "VIEW_FULL_LEAD"\)/);
  assert.match(service, /MAIL_LIST_VIEWED/);
  assert.match(service, /MAIL_SEARCH/);
  assert.match(service, /MAIL_MESSAGE_VIEWED/);
  assert.match(service, /BUSINESS_CORRESPONDENCE_PROCESSING/);
});

test("mail UI is explicitly read-only and does not expose send controls", async () => {
  const listPage = await readFile(listPageUrl, "utf8");
  const detailPage = await readFile(detailPageUrl, "utf8");
  const combined = listPage + "\n" + detailPage;

  assert.match(combined, /read-only/i);
  assert.match(combined, /не отправля(?:ет|ется|ются)/i);
  assert.doesNotMatch(combined, /sendMail|smtp|POST.*mail|Отправить письмо/i);
});

test("local mail analysis does not call an external AI provider", async () => {
  const service = await readFile(serviceUrl, "utf8");
  assert.match(service, /analyzeMailLocally/);
  assert.doesNotMatch(service, /fetch\(|YANDEX_AI|OPENAI|ANTHROPIC|GEMINI|foundationModels/i);
});
