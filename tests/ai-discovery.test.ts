import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("AI discovery endpoints use the manufacturing source of truth", () => {
  const facts = source("data/manufacturing-facts.ts");
  const compact = source("app/llms.txt/route.ts");
  const full = source("app/llms-full.txt/route.ts");

  assert.equal(existsSync("public/llms.txt"), false, "public/llms.txt must not shadow the generated /llms.txt route");
  assert.match(facts, /floorArea: "2 000\+ м²"/);
  assert.match(facts, /specialists: "70\+"/);
  assert.match(facts, /annualMetalCassetteOutput: "около 60 000 м²\/год"/);
  assert.match(facts, /onSiteInstallation: false/);
  assert.match(facts, /laserComplexes: 3/);
  assert.match(facts, /pressBrakes: 4/);
  assert.match(facts, /panelBenders: 1/);
  assert.match(facts, /weldingStations: 4/);
  assert.match(facts, /powderCoatingBooths: 3/);
  assert.match(facts, /shotBlastingChambers: 1/);
  assert.match(facts, /laserCleaningSystems: 1/);

  for (const content of [compact, full]) {
    assert.match(content, /productionScaleSummary/);
    assert.match(content, /metalCassetteOutputSummary/);
    assert.match(content, /installationScopeSummary/);
    assert.match(content, /бренд\/товарный знак, не юридическое лицо/);
    assert.doesNotMatch(content, /60 000 м²/);
    assert.doesNotMatch(content, /Монтаж на объектах не выполняется/);
  }

  assert.match(full, /productionEquipmentSummary/);
});

test("robots explicitly permits major search and AI crawlers without opening private routes", () => {
  const robots = source("app/robots.txt/route.ts");

  assert.match(robots, /User-agent: \*/);
  for (const crawler of [
    "bingbot",
    "YandexBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "PerplexityBot",
    "Perplexity-User",
    "Claude-SearchBot",
    "Claude-User",
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
  ]) {
    assert.match(robots, new RegExp(`User-agent: ${crawler}`));
  }

  assert.ok((robots.match(/Disallow: \/api\//g) ?? []).length >= 4);
  assert.ok((robots.match(/Disallow: \/internal\//g) ?? []).length >= 4);
});

test("IndexNow uses the global endpoint and runs after successful deploy with deployed SHA and changed routes", () => {
  const script = source("scripts/submit-indexnow.mjs");
  const workflow = source(".github/workflows/indexnow-after-deploy.yml");

  assert.match(script, /https:\/\/api\.indexnow\.org\/indexnow/);
  assert.match(script, /priorityUrls/);
  assert.match(script, /requestedUrls/);
  assert.match(script, /llms\.txt/);
  assert.match(script, /llms-full\.txt/);
  assert.match(workflow, /workflows:\s*\n\s*- Publish to Beget/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /workflow_run\.head_sha/);
  assert.match(workflow, /git diff --name-only HEAD\^ HEAD/);
  assert.match(workflow, /node scripts\/submit-indexnow\.mjs/);
});
