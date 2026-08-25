import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const quoteFormPath = new URL("../components/QuoteRequestForm.tsx", import.meta.url);

test("quote form validates the required name before the network request", async () => {
  const quoteForm = await readFile(quoteFormPath, "utf8");

  const nameValidation = quoteForm.indexOf('const name = String(formData.get("name")');
  const networkSubmit = quoteForm.indexOf('fetch("/api/quote"');

  assert.ok(nameValidation >= 0, "client-side name validation must exist");
  assert.ok(networkSubmit > nameValidation, "name must be validated before the API request");
  assert.match(quoteForm, /if \(!name\) \{/);
  assert.match(quoteForm, /Укажите имя — это обязательное поле\./);
  assert.match(quoteForm, /focusFormField\(form, "name"\)/);
  assert.match(quoteForm, /field instanceof HTMLElement\) field\.focus\(\)/);
});
