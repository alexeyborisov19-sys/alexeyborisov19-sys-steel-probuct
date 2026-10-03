import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const braces = require("../vendor/braces-depth-guard");
test("guard preserves ordinary nested globs and numeric ranges", () => {
  assert.deepEqual(braces.expand("a/{b,{c,d}}/{1..2}"), [
    "a/b/1",
    "a/b/2",
    "a/c/1",
    "a/c/2",
    "a/d/1",
    "a/d/2",
  ]);
  assert.equal(braces.compile("a/{b,c}"), "a/(b|c)");
  assert.equal(braces.stringify(braces.parse("a/{b,c}")), "a/{b,c}");
});
test("deep valid and unclosed patterns reject before recursive AST traversal", () => {
  for (const pattern of [
    "{".repeat(4000) + "x" + "}".repeat(4000),
    "(".repeat(4000) + "x" + ")".repeat(4000),
    "{".repeat(4000) + "x",
  ]) {
    for (const method of ["parse", "compile", "expand", "stringify"])
      assert.throws(() => braces[method](pattern), /nesting limit/);
  }
});
test("caller supplied deep or cyclic AST cannot bypass traversal guard", () => {
  const root = { type: "root", nodes: [] as unknown[] };
  let n = root;
  for (let i = 0; i < 5000; i++) {
    const child = { type: "root", nodes: [] as unknown[] };
    n.nodes.push(child);
    n = child;
  }
  for (const method of ["compile", "expand", "stringify"])
    assert.throws(() => braces[method](root), /nesting limit/);
  const cycle = { type: "root", nodes: [] as unknown[] };
  cycle.nodes.push(cycle);
  for (const method of ["compile", "expand", "stringify"])
    assert.throws(() => braces[method](cycle), /cyclic/);
});
test("installed dependency uses the reviewed fork", () => {
  assert.equal(
    require("braces/package.json").name,
    "@steelprodukt/braces-depth-guard",
  );
  assert.throws(
    () => require("braces").parse("{".repeat(4000) + "x"),
    /nesting limit/,
  );
});
