import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const headerPath = new URL("../components/Header.tsx", import.meta.url);
const megaMenuPath = new URL("../components/MegaMenu.tsx", import.meta.url);

test("header navigation exposes active state for nested routes and closes with Escape", async () => {
  const header = await readFile(headerPath, "utf8");

  assert.match(header, /pathname === href \|\| pathname\.startsWith\(`\$\{href\}\//);
  assert.match(header, /event\.key === "Escape"/);
  assert.match(header, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(header, /aria-expanded=\{solutionsOpen\}/);
  assert.match(header, /aria-expanded=\{mobileOpen\}/);
});

test("mega menu closes when keyboard focus leaves it", async () => {
  const megaMenu = await readFile(megaMenuPath, "utf8");

  assert.match(megaMenu, /onBlur=\{\(event\) => \{/);
  assert.match(megaMenu, /event\.currentTarget\.contains\(event\.relatedTarget as Node \| null\)/);
  assert.match(megaMenu, /onMouseLeave=\{onClose\}/);
});
