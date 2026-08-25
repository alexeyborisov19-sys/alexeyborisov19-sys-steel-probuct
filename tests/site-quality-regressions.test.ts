import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicLayoutPath = new URL("../app/(public)/layout.tsx", import.meta.url);
const preloaderPath = new URL("../components/SitePreloader.tsx", import.meta.url);
const productPagePath = new URL("../app/(public)/products/[slug]/page.tsx", import.meta.url);
const eslintPath = new URL("../eslint.config.mjs", import.meta.url);
const deployWorkflowPath = new URL("../.github/workflows/deploy-beget.yml", import.meta.url);

test("the approved branded preloader stays enabled without undoing reduced-motion support", async () => {
  const [layout, preloader] = await Promise.all([
    readFile(publicLayoutPath, "utf8"),
    readFile(preloaderPath, "utf8"),
  ]);

  assert.match(layout, /import \{ SitePreloader \} from "@\/components\/SitePreloader"/);
  assert.match(layout, /<SitePreloader \/>/);
  assert.match(preloader, /prefers-reduced-motion: reduce/);
  assert.match(preloader, /Инженерные решения из листового металла/);
});

test("technical product specifications keep a project-specific qualification", async () => {
  const productPage = await readFile(productPagePath, "utf8");

  assert.match(productPage, /Параметры на странице описывают доступные или типовые исполнения/);
  assert.match(productPage, /итоговые значения фиксируются по проектной документации/);
});

test("Codex agent runtimes remain outside lint and production deployment scope", async () => {
  const [eslintConfig, deployWorkflow] = await Promise.all([
    readFile(eslintPath, "utf8"),
    readFile(deployWorkflowPath, "utf8"),
  ]);

  for (const path of [".agents", ".codex", ".claude", ".claude-flow"]) {
    assert.ok(eslintConfig.includes(`\"${path}/**\"`), `${path} must remain excluded from ESLint`);
    assert.ok(deployWorkflow.includes(`--exclude='${path}/'`), `${path} must remain excluded from production rsync`);
  }

  assert.match(deployWorkflow, /paths-ignore:/);
  assert.match(deployWorkflow, /'\.agents\/\*\*'/);
  assert.match(deployWorkflow, /'AGENTS\.md'/);
});
