import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const quoteFormPath = new URL("../components/QuoteRequestForm.tsx", import.meta.url);

test("quote form validates required inputs before the network request and focuses the actionable field", async () => {
  const quoteForm = await readFile(quoteFormPath, "utf8");

  const nameValidation = quoteForm.indexOf('const name = String(formData.get("name")');
  const networkSubmit = quoteForm.indexOf('fetch("/api/quote"');

  assert.ok(nameValidation >= 0, "client-side validation must exist");
  assert.ok(networkSubmit > nameValidation, "validation must happen before the API request");
  assert.match(quoteForm, /focusFormField\(form, "name"\)/);
  assert.match(quoteForm, /if \(!phone && !email\)[\s\S]*focusFormField\(form, "phone"\)/);
  assert.match(quoteForm, /if \(email && !\/\^\\S\+@\\S\+\\\.\\S\+\$\/\.test\(email\)\)[\s\S]*focusFormField\(form, "email"\)/);
  assert.match(quoteForm, /formData\.get\("personalDataConsent"\) !== "yes"[\s\S]*focusFormField\(form, "personalDataConsent"\)/);
  assert.match(quoteForm, /field instanceof HTMLElement\) field\.focus\(\)/);
});
