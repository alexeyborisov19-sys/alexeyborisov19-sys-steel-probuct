import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { POST as quotePost } from "@/app/api/quote/route";
import { legalDocumentVersions } from "@/lib/legal";
import { rateLimitStore } from "@/lib/security/rate-limit";

test("quote records server-owned consent versions instead of client values", async () => {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-quote-route-"));
  const previousEnvironment = {
    quote: process.env.QUOTE_STORAGE_PATH,
    quarantine: process.env.UPLOAD_QUARANTINE_PATH,
    audit: process.env.CONSENT_AUDIT_STORAGE_PATH,
  };
  process.env.QUOTE_STORAGE_PATH = join(root, "quotes");
  process.env.UPLOAD_QUARANTINE_PATH = join(root, "quarantine");
  process.env.CONSENT_AUDIT_STORAGE_PATH = join(root, "consent");
  rateLimitStore.clear();

  try {
    const form = new FormData();
    form.set("name", "Инженер");
    form.set("email", "engineer@example.ru");
    form.set("personalDataConsent", "yes");
    form.set("marketingConsent", "yes");
    form.set("personalDataConsentVersion", "attacker-controlled-version");
    form.set("privacyVersion", "attacker-controlled-version");
    form.set("marketingConsentVersion", "attacker-controlled-version");

    const response = await quotePost(new Request("http://localhost/api/quote", {
      method: "POST",
      body: form,
    }));
    assert.equal(response.status, 200);

    const [recordName] = await readdir(process.env.QUOTE_STORAGE_PATH);
    const record = JSON.parse(await readFile(join(process.env.QUOTE_STORAGE_PATH, recordName), "utf8")) as {
      consent: {
        personalDataConsentVersion: string;
        privacyVersion: string;
        marketingConsentVersion: string;
      };
    };
    assert.equal(record.consent.personalDataConsentVersion, legalDocumentVersions.personalDataConsent);
    assert.equal(record.consent.privacyVersion, legalDocumentVersions.privacy);
    assert.equal(record.consent.marketingConsentVersion, legalDocumentVersions.marketingConsent);
    assert.equal(JSON.stringify(record).includes("attacker-controlled-version"), false);
  } finally {
    rateLimitStore.clear();
    if (previousEnvironment.quote === undefined) delete process.env.QUOTE_STORAGE_PATH;
    else process.env.QUOTE_STORAGE_PATH = previousEnvironment.quote;
    if (previousEnvironment.quarantine === undefined) delete process.env.UPLOAD_QUARANTINE_PATH;
    else process.env.UPLOAD_QUARANTINE_PATH = previousEnvironment.quarantine;
    if (previousEnvironment.audit === undefined) delete process.env.CONSENT_AUDIT_STORAGE_PATH;
    else process.env.CONSENT_AUDIT_STORAGE_PATH = previousEnvironment.audit;
  }
});
