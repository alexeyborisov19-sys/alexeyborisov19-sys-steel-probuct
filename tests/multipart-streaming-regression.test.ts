import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTick } from "node:timers/promises";
import { PayloadTooLargeError, readJsonBody, readMultipartForm } from "../lib/security/request-body";

const endpoint = "http://localhost/api/quote";
const encoder = new TextEncoder();

function streamRequest(bytes: Uint8Array, options: {
  chunkSize?: number;
  contentType?: string;
  contentLength?: string;
  cancel?: () => void;
  close?: () => void;
} = {}) {
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === bytes.length) { options.close?.(); controller.close(); return; }
      const end = Math.min(bytes.length, offset + (options.chunkSize ?? 13));
      controller.enqueue(bytes.slice(offset, end));
      offset = end;
    },
    cancel() { options.cancel?.(); },
  });
  const headers = new Headers({ "content-type": options.contentType ?? "application/x-www-form-urlencoded" });
  if (options.contentLength !== undefined) headers.set("content-length", options.contentLength);
  const init: RequestInit & { duplex: "half" } = { method: "POST", headers, body, duplex: "half" };
  return new Request(endpoint, init);
}

function fixture() {
  const form = new FormData();
  form.append("name", "ТЕСТ: инженерная заявка");
  form.append("message", "Строка 1\nСтрока 2");
  form.append("personalDataConsent", "yes");
  form.append("files", new File([new Uint8Array([0, 1, 10, 128, 255])], "drawing.bin", { type: "application/octet-stream" }));
  form.append("files", new File(["sample-dxf"], "part.dxf", { type: "application/dxf" }));
  return new Request(endpoint, { method: "POST", body: form });
}

test("streaming multipart keeps Unicode text and separate consent fields", async () => {
  const form = await readMultipartForm(fixture(), 10000);
  assert.equal(form.get("name"), "ТЕСТ: инженерная заявка");
  assert.equal(form.get("message"), "Строка 1\r\nСтрока 2");
  assert.equal(form.get("personalDataConsent"), "yes");
  assert.equal(form.has("marketingConsent"), false);
});

test("streaming multipart preserves multiple files and binary bytes", async () => {
  const form = await readMultipartForm(fixture(), 10000);
  const files = form.getAll("files");
  assert.equal(files.length, 2);
  assert.ok(files[0] instanceof File);
  assert.ok(files[1] instanceof File);
  assert.equal(files[0].name, "drawing.bin");
  assert.deepEqual(new Uint8Array(await files[0].arrayBuffer()), new Uint8Array([0, 1, 10, 128, 255]));
  assert.equal(await files[1].text(), "sample-dxf");
});

test("streaming multipart accepts an empty multipart form", async () => {
  const form = await readMultipartForm(new Request(endpoint, { method: "POST", body: new FormData() }), 10000);
  assert.equal([...form.keys()].length, 0);
});

test("multipart at the exact byte limit is accepted even across tiny chunks", async () => {
  const source = fixture();
  const bytes = new Uint8Array(await source.arrayBuffer());
  const form = await readMultipartForm(streamRequest(bytes, {
    chunkSize: 3,
    contentType: source.headers.get("content-type")!,
  }), bytes.length);
  assert.equal(form.get("name"), "ТЕСТ: инженерная заявка");
});

test("multipart one byte over the limit retains PayloadTooLargeError", async () => {
  const source = fixture();
  const bytes = new Uint8Array(await source.arrayBuffer());
  await assert.rejects(readMultipartForm(streamRequest(bytes, {
    contentType: source.headers.get("content-type")!,
  }), bytes.length - 1), PayloadTooLargeError);
});

test("declared oversized payload is rejected without consuming the body", async () => {
  const request = streamRequest(encoder.encode("name=test"), { contentLength: "1001" });
  await assert.rejects(readMultipartForm(request, 1000), PayloadTooLargeError);
  assert.equal(request.bodyUsed, false);
  await request.body?.cancel();
});

test("an understated Content-Length cannot bypass the actual byte limit", async () => {
  await assert.rejects(readMultipartForm(streamRequest(encoder.encode("name=too-long"), {
    contentLength: "1", chunkSize: 2,
  }), 5), PayloadTooLargeError);
});

test("a missing Content-Length cannot bypass the actual byte limit", async () => {
  await assert.rejects(readMultipartForm(streamRequest(encoder.encode("name=too-long")), 5), PayloadTooLargeError);
});

test("a malformed Content-Length does not disable counting", async () => {
  await assert.rejects(readMultipartForm(streamRequest(encoder.encode("name=too-long"), {
    contentLength: "unknown",
  }), 5), PayloadTooLargeError);
});

test("oversized input cancels its upstream stream", async () => {
  let cancelled = false;
  await assert.rejects(readMultipartForm(streamRequest(encoder.encode("name=" + "a".repeat(1000)), {
    chunkSize: 10, cancel: () => { cancelled = true; },
  }), 30), PayloadTooLargeError);
  await nextTick();
  assert.equal(cancelled, true);
});

test("an upstream cancellation error cannot change the 413 classification", async () => {
  await assert.rejects(readMultipartForm(streamRequest(encoder.encode("name=" + "a".repeat(1000)), {
    chunkSize: 10, cancel: () => { throw new Error("synthetic cancellation error"); },
  }), 30), PayloadTooLargeError);
  await nextTick();
});

test("invalid form Content-Type leaves no unfinished upstream stream", async () => {
  let cancelled = false;
  let closed = false;
  await assert.rejects(readMultipartForm(streamRequest(encoder.encode("x".repeat(1000)), {
    contentType: "application/json", cancel: () => { cancelled = true; }, close: () => { closed = true; },
  }), 2000));
  await nextTick();
  assert.ok(cancelled || closed, "Parser must drain or cancel its upstream stream");
});

test("empty request body remains a parser error, not a false success", async () => {
  await assert.rejects(readMultipartForm(new Request(endpoint, {
    method: "POST", headers: { "content-type": "multipart/form-data; boundary=sample" },
  }), 1000));
});

test("a failing source is not misclassified as a size failure", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { controller.error(new Error("synthetic source error")); },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, duplex: "half",
  };
  await assert.rejects(readMultipartForm(new Request(endpoint, init), 1000), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(!(error instanceof PayloadTooLargeError));
    return true;
  });
});

test("JSON parsing and its existing size limit are unchanged", async () => {
  assert.deepEqual(await readJsonBody(new Request(endpoint, { method: "POST", body: '{"ok":true}' }), 100), { ok: true });
  await assert.rejects(readJsonBody(new Request(endpoint, { method: "POST", body: '{"ok":true}' }), 2), PayloadTooLargeError);
});
