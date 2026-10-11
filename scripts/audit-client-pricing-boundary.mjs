/** Defense in depth after next build; import-graph and DTO tests are the primary boundary. */
import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const forbidden=/\b(?:CLOSED_TYPE_RATE_FACTOR|rateRubM2|metalRubPerKg|laserRubPerM|pierceRubEach|powderRubPerM2|preparationRubPerM2|marketMeanRubBatch|PUBLIC_ASSEMBLY_ESTIMATE_MINUTES|confirmedDirectCostRub|rubPerTon|drawingPercentOfWorks|private-calculation-basis|assemblyRubPerHour)\b/;
let files=0;
async function visit(path){for(const entry of await readdir(path,{withFileTypes:true})){const child=`${path}/${entry.name}`;if(entry.isDirectory())await visit(child);else if(entry.name.endsWith('.js')){files++;assert.ok(!forbidden.test(await readFile(child,'utf8')),`Internal pricing identifier in client chunk: ${child}`);}}}
await visit('.next/static/chunks');assert.ok(files>0);console.log(`Client pricing boundary: ${files} compiled chunks checked.`);
