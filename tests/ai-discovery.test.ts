import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("AI discovery endpoints expose verified company facts", () => {
  const compact = source("app/llms.txt/route.ts");
  const full = source("app/llms-full.txt/route.ts");

  for (const content of [compact, full]) {
    assert.match(content, /60 000 м²/);
    assert.match(content, /Монтаж на объектах не выполняется/);
    assert.match(content, /юридическ/i);
  }
});

test("robots explicitly permits major AI retrieval crawlers without opening private routes", () => {
  const robots = source("app/robots.txt/route.ts");

  for (const crawler of ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User"]) {
    assert.match(robots, new RegExp(`User-agent: ${crawler}`));
  }

  assert.ok((robots.match(/Disallow: \/api\//g) ?? []).length >= 3);
  assert.ok((robots.match(/Disallow: \/internal\//g) ?? []).length >= 3);
});

test("IndexNow uses the global endpoint and runs only after a successful production deploy", () => {
  const script = source("scripts/submit-indexnow.mjs");
  const workflow = source(".github/workflows/indexnow-after-deploy.yml");

  assert.match(script, /https:\/\/api\.indexnow\.org\/indexnow/);
  assert.match(script, /llms\.txt/);
  assert.match(script, /llms-full\.txt/);
  assert.match(workflow, /workflows:\s*\n\s*- Publish to Beget/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /node scripts\/submit-indexnow\.mjs/);
});
