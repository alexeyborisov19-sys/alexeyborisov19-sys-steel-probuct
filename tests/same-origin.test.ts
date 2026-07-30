import assert from "node:assert/strict";
import test from "node:test";
import { POST as assistantPost } from "@/app/api/assistant/route";
import {
  assertSameOriginRequest,
  CrossSiteRequestError,
} from "@/lib/security/same-origin";

test("accepts a browser request from the same origin", () => {
  assert.doesNotThrow(() => assertSameOriginRequest(new Request("https://www.steelprodukt.ru/api/assistant", {
    method: "POST",
    headers: {
      origin: "https://www.steelprodukt.ru",
      "sec-fetch-site": "same-origin",
    },
  })));
});

test("accepts a server request without browser origin metadata", () => {
  assert.doesNotThrow(() => assertSameOriginRequest(new Request("https://www.steelprodukt.ru/api/assistant", {
    method: "POST",
  })));
});

test("rejects a mismatched Origin", () => {
  assert.throws(
    () => assertSameOriginRequest(new Request("https://www.steelprodukt.ru/api/assistant", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    })),
    CrossSiteRequestError,
  );
});

test("rejects explicit cross-site Fetch Metadata", () => {
  assert.throws(
    () => assertSameOriginRequest(new Request("https://www.steelprodukt.ru/api/assistant", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    })),
    CrossSiteRequestError,
  );
});

test("/api/assistant returns 403 before parsing a cross-site request", async () => {
  const response = await assistantPost(new Request("https://www.steelprodukt.ru/api/assistant", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
    },
    body: JSON.stringify({ message: "Нужен корпус" }),
  }));
  assert.equal(response.status, 403);
});
