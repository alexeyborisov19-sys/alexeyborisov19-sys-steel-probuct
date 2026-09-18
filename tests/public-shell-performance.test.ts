import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicLayout = readFileSync("app/(public)/layout.tsx", "utf8");
const productionCycle = readFileSync("components/ProductionCycle.tsx", "utf8");
const globals = readFileSync("app/globals.css", "utf8");
const articlesLayout = readFileSync("app/(public)/articles/layout.tsx", "utf8");
const journalCss = readFileSync("app/(public)/articles/journal.css", "utf8");

test("public shell does not block first paint with SitePreloader", () => {
  assert.doesNotMatch(publicLayout, /SitePreloader/);
  assert.doesNotMatch(globals, /\.site-preloader/);
});

test("production cycle renders without a client hydration island", () => {
  assert.doesNotMatch(productionCycle, /^["']use client["'];/m);
  assert.doesNotMatch(productionCycle, /IntersectionObserver|useEffect|useState|useRef/);
  assert.match(productionCycle, /className="production-cycle-track"/);
});

test("journal-only CSS stays out of the global public bundle", () => {
  assert.doesNotMatch(globals, /\.journal-grid-overlay|\.journal-sidebar-link|\.journal-card-feature/);
  assert.match(articlesLayout, /import "\.\/journal\.css"/);
  assert.match(journalCss, /\.journal-grid-overlay/);
  assert.match(journalCss, /\.journal-sidebar-link/);
  assert.match(journalCss, /\.journal-card-feature/);
});
