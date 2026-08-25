import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lazyLauncherPath = new URL("../components/EngineeringAssistantLauncher.tsx", import.meta.url);
const loadedAssistantPath = new URL("../components/EngineeringAssistant.tsx", import.meta.url);

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
