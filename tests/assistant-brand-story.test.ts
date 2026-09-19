import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantSuggestions,
  buildKnowledgeFallback,
} from "../data/assistant-knowledge";
import { steelProductBrandStory } from "../data/assistant-brand-story";
import {
  productionEquipment,
  productionScale,
} from "../data/manufacturing-facts";

test("brand story is returned for identity and history questions", () => {
  for (const query of [
    "Кто вы?",
    "Чем занимается Сталь Продукт?",
    "Расскажите про Сталь Продукт",
    "Расскажите вашу историю",
  ]) {
    assert.equal(buildKnowledgeFallback(query), steelProductBrandStory);
  }
});

test("brand story reflects confirmed production facts", () => {
  assert.match(steelProductBrandStory, /инженерно-производственный бренд/i);
  assert.ok(steelProductBrandStory.includes(productionScale.floorArea));
  assert.ok(steelProductBrandStory.includes(productionScale.specialists + " специалистов"));
  assert.ok(steelProductBrandStory.includes(productionEquipment.laserComplexes + " лазерных комплекса"));
  assert.ok(steelProductBrandStory.includes(productionEquipment.pressBrakes + " листогибочных комплекса"));
  assert.ok(steelProductBrandStory.includes(productionEquipment.weldingStations + " сварочных поста"));
  assert.match(steelProductBrandStory, /серийное и OEM-производство/i);
  assert.match(steelProductBrandStory, /Монтаж на объектах мы не выполняем/i);
});

test("identity questions get relevant follow-up suggestions", () => {
  assert.deepEqual(
    assistantSuggestions("Расскажите о Сталь Продукт"),
    ["Что вы производите?", "Как устроено производство?", "Индивидуальные и OEM-решения"],
  );
});
