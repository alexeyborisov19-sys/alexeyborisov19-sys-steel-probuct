import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lazyLauncherPath = new URL("../components/EngineeringAssistantLauncher.tsx", import.meta.url);
const loadedAssistantPath = new URL("../components/NavigationAssistant.tsx", import.meta.url);

test("assistant launcher stays compact on mobile before and after first activation", async () => {
  const [lazyLauncher, loadedAssistant] = await Promise.all([
    readFile(lazyLauncherPath, "utf8"),
    readFile(loadedAssistantPath, "utf8"),
  ]);

  const compactButton = /assistant-launcher[^\n]*gap-0[^\n]*px-1\.5[^\n]*sm:gap-3[^\n]*sm:pl-3[^\n]*sm:pr-4/;
  const hiddenMobileLabel = /hidden min-w-\[142px\] whitespace-nowrap text-left sm:block/;

  assert.match(lazyLauncher, compactButton, "initial launcher must stay compact on mobile");
  assert.match(lazyLauncher, hiddenMobileLabel, "initial launcher label must remain hidden below sm");
  assert.match(loadedAssistant, compactButton, "loaded launcher must keep the same compact mobile shell after closing");
  assert.match(loadedAssistant, hiddenMobileLabel, "loaded launcher label must remain hidden below sm after closing");
});

test("calculator routes suppress the launcher before either lazy or activated rendering", async () => {
  const source = await readFile(lazyLauncherPath, "utf8");
  const guard = source.slice(source.indexOf("// Configurators"), source.indexOf("if (!activated)"));
  for (const route of ["/calculator-metallokassety", "/products/metallokassety/bim", "/products/dobornye-elementy/bim", "/products/korziny-dlya-konditsionerov", "/online-order"]) {
    assert.ok(guard.includes(`pathname === "${route}"`), `${route} must not have a floating assistant over its controls`);
  }
  assert.match(guard, /return null/);
  assert.match(guard, /startsWith\("\/internal\/"\)/);
  assert.match(source, /if \(!activated\) return <LauncherButton/);
});
