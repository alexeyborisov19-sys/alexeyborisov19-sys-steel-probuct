import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexNowWorkflow = fs.readFileSync(".github/workflows/indexnow-after-deploy.yml", "utf8");
const verifyWorkflow = fs.readFileSync(".github/workflows/verify-project-package.yml", "utf8");
const indexNowSubmitter = fs.readFileSync("scripts/submit-indexnow.mjs", "utf8");
const interactionCss = fs.readFileSync("app/interaction-accessibility.css", "utf8");
const rootLayout = fs.readFileSync("app/layout.tsx", "utf8");

test("IndexNow expands article changes to concrete article URLs", () => {
  assert.match(indexNowWorkflow, /append_article_paths\(\)/);
  assert.match(indexNowWorkflow, /app\/\\\(public\\\)\/articles\/\*/);
  assert.match(indexNowWorkflow, /data\/articles\.ts\|data\/article-editorial\.ts\|data\/article-quality-rewrites\.ts/);
  assert.match(indexNowWorkflow, /\\\/articles\\\/\\1/);
});

test("the commercial sitemap priority boundary remains intentional", () => {
  assert.match(indexNowSubmitter, /minimumSitemapPriority\s*=\s*0\.85/);
});

test("project verification runs for pull requests targeting any base branch", () => {
  assert.match(verifyWorkflow, /^  pull_request: \{\}$/m);
  assert.doesNotMatch(verifyWorkflow, /pull_request:\s*\n\s+branches:/);
});

test("shared interaction accessibility rules are loaded once at the root", () => {
  assert.match(rootLayout, /import "\.\/interaction-accessibility\.css";/);
  for (const opacity of ["25", "28", "30", "35", "38"]) {
    assert.match(interactionCss, new RegExp(`\\.text-white\\\\/${opacity}`));
  }
  assert.match(interactionCss, /button:not\(:disabled\)\)\):active/);
  assert.match(interactionCss, /-webkit-tap-highlight-color/);
});
