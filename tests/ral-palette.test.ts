import test from "node:test";
import assert from "node:assert/strict";
import { ralPalette, filterRalPalette } from "../lib/bim/ral-palette";

test("RAL palette has unique four-digit codes and usable preview colours",()=>{
 assert.ok(ralPalette.length >= 70);
 assert.equal(new Set(ralPalette.map(c=>c.code)).size,ralPalette.length);
 for(const c of ralPalette){ assert.match(c.code,/^[1-9][0-9]{3}$/); assert.match(c.hex,/^#[0-9a-f]{6}$/i);assert.ok(c.name); }
});
test("RAL search accepts pasted RAL codes, Russian names and overrides a family filter",()=>{
 assert.deepEqual(filterRalPalette("RAL 7016","3").map(c=>c.code),["7016"]);
 assert.ok(filterRalPalette("зеленыЙ","all").some(c=>c.code==="6005"));
 assert.ok(filterRalPalette("","7").every(c=>c.code.startsWith("7")));
 assert.equal(filterRalPalette("9999","all").length,0);
 assert.equal(filterRalPalette("","popular").length,12);
});
