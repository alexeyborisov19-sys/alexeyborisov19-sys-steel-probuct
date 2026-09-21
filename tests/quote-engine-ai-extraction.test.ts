import assert from "node:assert/strict";
import test from "node:test";
import { extractWithAi } from "../lib/server/quote-engine/ai-extraction";
import { emptyLeadState } from "../lib/assistant/state";

/**
 * The network call itself is not exercised here — it is off unless an operator
 * configures it, and it degrades to `null` on every failure path by
 * construction. What matters, and what this file covers, is that whatever a
 * model returns is treated as a proposal and nothing more.
 */

const message = "нужен кронштейн из оцинковки, лист в два миллиметра, полста штук";

test("a model answer wrapped in a markdown fence is still read", async () => {
  const outcome = await extractWithAi(emptyLeadState(), message, async () =>
    "```json\n{\"thickness\":{\"value\":\"2 мм\",\"quote\":\"лист в два миллиметра\"}}\n```");
  assert.equal(outcome.state.thickness, "2 мм");
});

test("a model that returns prose instead of JSON changes nothing", async () => {
  const outcome = await extractWithAi(emptyLeadState(), message, async () =>
    "Похоже, клиент имеет в виду лист 2 мм из оцинкованной стали.");
  assert.deepEqual(outcome.state, emptyLeadState());
  assert.deepEqual(outcome.accepted, []);
});

test("a model that throws never breaks the turn", async () => {
  const outcome = await extractWithAi(emptyLeadState(), message, async () => {
    throw new Error("upstream is down");
  });
  assert.deepEqual(outcome.state, emptyLeadState());
  assert.deepEqual(outcome.accepted, []);
});

test("a model that times out into null simply contributes nothing", async () => {
  const outcome = await extractWithAi(emptyLeadState(), message, async () => null);
  assert.deepEqual(outcome.accepted, []);
});

test("an empty customer message is never sent to the model at all", async () => {
  let called = false;
  await extractWithAi(emptyLeadState(), "   ", async () => {
    called = true;
    return null;
  });
  assert.equal(called, false);
});

test("a model inventing a parameter the customer never stated is rejected end to end", async () => {
  const outcome = await extractWithAi(emptyLeadState(), message, async () =>
    JSON.stringify({
      thickness: { value: "2 мм", quote: "лист в два миллиметра" },
      dimensions: { value: "500×400", quote: "габариты пятьсот на четыреста" },
    }));
  assert.equal(outcome.state.thickness, "2 мм", "what was said is taken");
  assert.equal(outcome.state.dimensions, undefined, "what was not said is refused");
  assert.deepEqual(outcome.rejected, [{ field: "dimensions", reason: "ungrounded" }]);
});

test("the model is given the message and the state it is meant to complete", async () => {
  const seen: Array<{ message: string; known: unknown }> = [];
  const known = { ...emptyLeadState(), material: "Оцинкованная сталь" };
  await extractWithAi(known, message, async (passedMessage, passedState) => {
    seen.push({ message: passedMessage, known: passedState.material });
    return null;
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].message, message);
  assert.equal(seen[0].known, "Оцинкованная сталь");
});
