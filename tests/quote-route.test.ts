import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { legalDocumentVersions } from "@/lib/legal";
import { createQuoteHandler, type QuoteHandlerDependencies } from "@/lib/quote/handler";
import { QuoteStorageError } from "@/lib/quote/storage";
import { rateLimitStore } from "@/lib/security/rate-limit";

const environmentKeys = [
  "QUOTE_STORAGE_PATH",
  "UPLOAD_QUARANTINE_PATH",
  "CONSENT_AUDIT_STORAGE_PATH",
  "IP_HASH_SALT",
  "CONSENT_AUDIT_SALT",
  "CLAMAV_ENABLED",
  "TRUST_NGINX_PROXY",
] as const;

async function setupEnvironment() {
  const root = await mkdtemp(join(tmpdir(), "steelprodukt-quote-route-"));
  const previous = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  process.env.QUOTE_STORAGE_PATH = join(root, "quotes");
  process.env.UPLOAD_QUARANTINE_PATH = join(root, "quarantine");
  process.env.CONSENT_AUDIT_STORAGE_PATH = join(root, "consent");
  process.env.IP_HASH_SALT = "test-ip-hash-salt-that-is-longer-than-32-characters";
  process.env.CONSENT_AUDIT_SALT = "test-consent-audit-salt-that-is-different-and-long";
  process.env.CLAMAV_ENABLED = "false";
  process.env.TRUST_NGINX_PROXY = "false";
  rateLimitStore.clear();
  return {
    root,
    quotes: process.env.QUOTE_STORAGE_PATH,
    consent: process.env.CONSENT_AUDIT_STORAGE_PATH,
    async cleanup() {
      rateLimitStore.clear();
      for (const key of environmentKeys) {
        const value = previous[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await rm(root, { recursive: true, force: true });
    },
  };
}

function validForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("name", "Инженер");
  form.set("email", "engineer@example.ru");
  form.set("message", "Нужен предварительный расчёт");
  form.set("personalDataConsent", "yes");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

function request(form: FormData, headers: HeadersInit = {}) {
  return new Request("https://www.steelprodukt.ru/api/quote", {
    method: "POST",
    headers: {
      origin: "https://www.steelprodukt.ru",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: form,
  });
}

function handler(overrides: Partial<QuoteHandlerDependencies> = {}) {
  return createQuoteHandler({
    deliverQuoteEmail: async () => undefined,
    ...overrides,
  });
}

async function responsePayload(response: Response) {
  return response.json() as Promise<{ ok: boolean; requestId: string; code: string; message: string }>;
}

function pdf(name = "drawing.pdf") {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])], name, {
    type: "application/pdf",
  });
}

test("accepts and stores a quote without files", async () => {
  const environment = await setupEnvironment();
  try {
    const response = await handler()(request(validForm()));
    const payload = await responsePayload(response);
    assert.equal(response.status, 200);
    assert.equal(payload.code, "ACCEPTED");
    assert.match(payload.requestId, /^SP-\d{8}-[A-F0-9]{8}$/);
    assert.equal(response.headers.get("x-request-id"), payload.requestId);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const records = await readdir(environment.quotes);
    const audits = await readdir(environment.consent);
    assert.equal(records.length, 1);
    assert.equal(audits.length, 1);
    assert.equal((await stat(join(environment.quotes, records[0]))).mode & 0o777, 0o600);
  } finally {
    await environment.cleanup();
  }
});

test("accepts and quarantines a small PDF", async () => {
  const environment = await setupEnvironment();
  try {
    const form = validForm({ message: "PDF во вложении" });
    form.append("files", pdf());
    const response = await handler()(request(form));
    const payload = await responsePayload(response);
    assert.equal(response.status, 200);
    const [recordName] = await readdir(environment.quotes);
    const record = JSON.parse(await readFile(join(environment.quotes, recordName), "utf8")) as {
      files: Array<{ storageId: string; antivirus: string }>;
    };
    assert.equal(record.files.length, 1);
    assert.equal(record.files[0].antivirus, "not-configured");
    assert.equal((await stat(join(environment.root, "quarantine", payload.requestId, record.files[0].storageId))).mode & 0o777, 0o600);
  } finally {
    await environment.cleanup();
  }
});

test("accepts an allowed PNG image", async () => {
  const environment = await setupEnvironment();
  try {
    const form = validForm({ message: "Изображение во вложении" });
    form.append("files", new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], "detail.png", { type: "image/png" }));
    const response = await handler()(request(form));
    assert.equal(response.status, 200);
  } finally {
    await environment.cleanup();
  }
});

test("keeps the stored quote successful when SMTP is unavailable", async () => {
  const environment = await setupEnvironment();
  try {
    const response = await handler({
      deliverQuoteEmail: async () => {
        throw new Error("synthetic SMTP outage");
      },
    })(request(validForm({ message: "SMTP deferred test" })));
    const payload = await responsePayload(response);
    assert.equal(response.status, 202);
    assert.equal(payload.ok, true);
    assert.equal(payload.code, "SMTP_DELIVERY_DEFERRED");
    const [recordName] = await readdir(environment.quotes);
    const record = JSON.parse(await readFile(join(environment.quotes, recordName), "utf8")) as { delivery: string };
    assert.equal(record.delivery, "stored");
  } finally {
    await environment.cleanup();
  }
});

test("keeps the stored quote successful when consent audit is temporarily unavailable", async () => {
  const environment = await setupEnvironment();
  try {
    const response = await handler({
      recordConsentAudit: async () => {
        throw new Error("synthetic consent storage outage");
      },
    })(request(validForm({ message: "Consent audit deferred test" })));
    const payload = await responsePayload(response);
    assert.equal(response.status, 202);
    assert.equal(payload.ok, true);
    assert.equal(payload.code, "CONSENT_AUDIT_DEFERRED");
    const [recordName] = await readdir(environment.quotes);
    const record = JSON.parse(await readFile(join(environment.quotes, recordName), "utf8")) as {
      consentAudit: string;
      delivery: string;
    };
    assert.equal(record.consentAudit, "deferred");
    assert.equal(record.delivery, "email");
  } finally {
    await environment.cleanup();
  }
});

test("detects missing mandatory environment before parsing the quote", async () => {
  rateLimitStore.clear();
  let inspected = false;
  const response = await handler({
    validateEnvironment: () => [{ key: "IP_HASH_SALT", message: "required" }],
    inspectUploads: async () => {
      inspected = true;
      return [];
    },
  })(request(validForm({ message: "Config test" })));
  const payload = await responsePayload(response);
  assert.equal(response.status, 503);
  assert.equal(payload.code, "CONFIGURATION_ERROR");
  assert.equal(inspected, false);
  rateLimitStore.clear();
});

test("returns STORAGE_ERROR when the protected lead directory is not writable", async () => {
  const environment = await setupEnvironment();
  try {
    const response = await handler({
      createQuoteRecord: async () => {
        throw new QuoteStorageError();
      },
    })(request(validForm({ message: "Storage failure test" })));
    const payload = await responsePayload(response);
    assert.equal(response.status, 500);
    assert.equal(payload.code, "STORAGE_ERROR");
  } finally {
    await environment.cleanup();
  }
});

test("returns STORAGE_ERROR when the protected quarantine is not writable", async () => {
  const environment = await setupEnvironment();
  try {
    const form = validForm({ message: "Quarantine failure test" });
    form.append("files", pdf());
    const response = await handler({
      quarantineUploads: async () => {
        throw new Error("synthetic quarantine outage");
      },
    })(request(form));
    const payload = await responsePayload(response);
    assert.equal(response.status, 500);
    assert.equal(payload.code, "STORAGE_ERROR");
    await assert.rejects(() => readdir(environment.quotes));
  } finally {
    await environment.cleanup();
  }
});

test("rejects a MIME type that conflicts with the file extension", async () => {
  const environment = await setupEnvironment();
  try {
    const form = validForm({ message: "Wrong MIME" });
    form.append("files", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "drawing.pdf", { type: "image/png" }));
    const response = await handler()(request(form));
    const payload = await responsePayload(response);
    assert.equal(response.status, 400);
    assert.equal(payload.code, "UPLOAD_REJECTED");
  } finally {
    await environment.cleanup();
  }
});

test("rejects a file above the per-file limit", async () => {
  const environment = await setupEnvironment();
  try {
    const form = validForm({ message: "Large file" });
    form.append("files", new File([new Uint8Array(7 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" }));
    const response = await handler()(request(form));
    const payload = await responsePayload(response);
    assert.equal(response.status, 413);
    assert.equal(payload.code, "UPLOAD_REJECTED");
  } finally {
    await environment.cleanup();
  }
});

test("rejects files above the total attachment limit", async () => {
  const environment = await setupEnvironment();
  try {
    const makeLargePdf = (name: string) => {
      const bytes = new Uint8Array(5 * 1024 * 1024 + 1);
      bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
      return new File([bytes], name, { type: "application/pdf" });
    };
    const form = validForm({ message: "Total attachment limit" });
    form.append("files", makeLargePdf("first.pdf"));
    form.append("files", makeLargePdf("second.pdf"));
    const response = await handler()(request(form));
    const payload = await responsePayload(response);
    assert.equal(response.status, 413);
    assert.equal(payload.code, "UPLOAD_REJECTED");
  } finally {
    await environment.cleanup();
  }
});

test("rejects more than ten attachments", async () => {
  const environment = await setupEnvironment();
  try {
    const form = validForm({ message: "Attachment count limit" });
    for (let index = 0; index < 11; index += 1) form.append("files", pdf(`drawing-${index}.pdf`));
    const response = await handler()(request(form));
    assert.equal(response.status, 400);
    assert.equal((await responsePayload(response)).code, "UPLOAD_REJECTED");
  } finally {
    await environment.cleanup();
  }
});

test("rejects a multipart body above the route limit before parsing", async () => {
  const environment = await setupEnvironment();
  try {
    const response = await handler()(new Request("https://www.steelprodukt.ru/api/quote", {
      method: "POST",
      headers: {
        origin: "https://www.steelprodukt.ru",
        "sec-fetch-site": "same-origin",
        "content-type": "multipart/form-data; boundary=test",
        "content-length": String(11 * 1024 * 1024 + 1),
      },
      body: "--test--",
    }));
    assert.equal(response.status, 413);
    assert.equal((await responsePayload(response)).code, "UPLOAD_REJECTED");
  } finally {
    await environment.cleanup();
  }
});

test("rejects a duplicate quote", async () => {
  const environment = await setupEnvironment();
  try {
    const post = handler();
    const first = await post(request(validForm({ message: "Duplicate quote" })));
    const second = await post(request(validForm({ message: "Duplicate quote" })));
    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal((await responsePayload(second)).code, "DUPLICATE_REQUEST");
  } finally {
    await environment.cleanup();
  }
});

test("rate limits repeated quote attempts", async () => {
  const environment = await setupEnvironment();
  try {
    const post = handler();
    for (let index = 0; index < 3; index += 1) {
      const response = await post(request(validForm({ name: "", message: `Attempt ${index}` })));
      assert.equal(response.status, 400);
    }
    const limited = await post(request(validForm({ name: "", message: "Attempt 4" })));
    assert.equal(limited.status, 429);
    assert.equal((await responsePayload(limited)).code, "RATE_LIMITED");
  } finally {
    await environment.cleanup();
  }
});

test("rejects a cross-origin quote before processing", async () => {
  rateLimitStore.clear();
  const response = await handler()(request(validForm(), {
    origin: "https://attacker.example",
    "sec-fetch-site": "cross-site",
  }));
  assert.equal(response.status, 403);
  assert.equal((await responsePayload(response)).code, "CROSS_ORIGIN_REJECTED");
  rateLimitStore.clear();
});

test("requires personal data consent", async () => {
  const environment = await setupEnvironment();
  try {
    const response = await handler()(request(validForm({ personalDataConsent: "" })));
    assert.equal(response.status, 400);
    assert.equal((await responsePayload(response)).code, "VALIDATION_ERROR");
  } finally {
    await environment.cleanup();
  }
});

test("requires at least a phone or an e-mail", async () => {
  const environment = await setupEnvironment();
  try {
    const response = await handler()(request(validForm({ phone: "", email: "" })));
    assert.equal(response.status, 400);
  } finally {
    await environment.cleanup();
  }
});

test("rejects an invalid e-mail", async () => {
  const environment = await setupEnvironment();
  try {
    const response = await handler()(request(validForm({ email: "invalid" })));
    assert.equal(response.status, 400);
  } finally {
    await environment.cleanup();
  }
});

test("accepts a file marked clean by antivirus", async () => {
  const environment = await setupEnvironment();
  try {
    const form = validForm({ message: "Clean antivirus" });
    form.append("files", pdf());
    const response = await handler({
      quarantineUploads: async (_requestId, uploads) => uploads.map(({ buffer, ...upload }, index) => {
        assert.ok(buffer.length > 0);
        return {
          ...upload,
          storageId: `clean-${index}.pdf`,
          antivirus: "clean" as const,
        };
      }),
    })(request(form));
    assert.equal(response.status, 200);
  } finally {
    await environment.cleanup();
  }
});

test("returns 422 for an antivirus-blocked file before saving a quote", async () => {
  const environment = await setupEnvironment();
  let recordCreated = false;
  try {
    const form = validForm({ message: "Blocked antivirus" });
    form.append("files", pdf());
    const response = await handler({
      quarantineUploads: async (_requestId, uploads) => uploads.map(({ buffer, ...upload }, index) => {
        assert.ok(buffer.length > 0);
        return {
          ...upload,
          storageId: `blocked-${index}.pdf`,
          antivirus: "blocked" as const,
        };
      }),
      createQuoteRecord: async () => {
        recordCreated = true;
      },
    })(request(form));
    const payload = await responsePayload(response);
    assert.equal(response.status, 422);
    assert.equal(payload.code, "UPLOAD_REJECTED");
    assert.equal(recordCreated, false);
  } finally {
    await environment.cleanup();
  }
});

test("keeps server-owned consent versions", async () => {
  const environment = await setupEnvironment();
  try {
    const form = validForm({ marketingConsent: "yes" });
    form.set("personalDataConsentVersion", "attacker-controlled-version");
    form.set("privacyVersion", "attacker-controlled-version");
    form.set("marketingConsentVersion", "attacker-controlled-version");
    const response = await handler()(request(form));
    assert.equal(response.status, 200);
    const [recordName] = await readdir(environment.quotes);
    const record = JSON.parse(await readFile(join(environment.quotes, recordName), "utf8")) as {
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
    await environment.cleanup();
  }
});
