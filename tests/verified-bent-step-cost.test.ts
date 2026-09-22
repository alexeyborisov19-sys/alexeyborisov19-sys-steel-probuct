import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject, type InstantQuoteProject, type ProjectPart } from "../lib/instant-quote/domain";
import type { FactualCalculationResult, FactualCalculationLine } from "../lib/instant-quote/factual-calculation";
import type { ProjectFactualCalculationResult } from "../lib/instant-quote/project-factual-calculation";
import type { CommercialPricingPolicy } from "../lib/server/instant-quote/commercial-pricing";

import { reviewCadProjectCalculation } from "../lib/server/quote-engine/cad-stage-review";
import { runVerifiedLaserDfm } from "../lib/instant-quote/dfm";




import {readFile} from 'node:fs/promises';
import {occtStepKernel} from '../lib/instant-quote/occt-step-kernel';
import {createStepCadAdapter} from '../lib/instant-quote/step-adapter';
import {verifiedBentStepCostSource} from '../lib/instant-quote/verified-bent-step-cost';
import {calculateFactualProductionCost} from '../lib/instant-quote/factual-calculation';
function fixture() {
  const project: InstantQuoteProject = createEmptyProject(new Date("2026-09-21T09:00:00Z"));
  const part: ProjectPart = {
    id: "part-1", fileName: "private-customer@example.test.dxf", format: "dxf", fileSizeBytes: 500,
    createdAt: project.createdAt, state: "configurable", quote: { kind: "not-requested" },
    geometry: { widthMm: 100, heightMm: 100, thicknessMm: 1, areaMm2: 10000, blankAreaMm2: 10000, cutLengthMm: 400, pierceCount: 1, contourCount: 1, holeCount: 0 },
    configuration: { materialId: "hot", thicknessMm: 1, quantity: 10, operations: ["laser-cutting"] },
  };
  project.parts = [part];
  const line = (code: FactualCalculationLine["code"], each: number): FactualCalculationLine => ({
    code, label: "Fixture", quantity: 1, unit: "fixture", rateRub: each, amountRubEach: each, amountRubBatch: each * 10,
    source: { id: "private-fixture-rate", label: "Fixture", confirmedAt: project.createdAt, note: "Synthetic" },
  });
  const cost: FactualCalculationResult = {
    kind: "factual-direct-cost", status: "complete", currency: "RUB", quantity: 10, materialId: "hot", thicknessMm: 1,
    materialAllocationStrategy: null,
    parameters: { netAreaMm2: 10000, blankAreaMm2: 10000, netMassKgEach: 0.078, purchasedMassKgEach: 0.078,
      cutLengthMmEach: 400, pierceCountEach: 1, bendCountEach: null, weldLengthMEach: null,
      powderAreaM2Each: null, assemblyMinutesEach: null, surfacePreparationAreaM2Each: null },
    lines: [line("material", 100), line("laser-cutting", 10)],
    confirmedDirectCostRubEach: 110, confirmedDirectCostRubBatch: 1100,
    missing: [], warnings: [], commercialPriceReady: false,
  };
  const calculation: ProjectFactualCalculationResult = {
    kind: "project-factual-direct-cost",
    parts: [{ partId: part.id, status: "complete", calculation: cost, dfmBlockingReasons: [], dfmReviewReasons: [] }],
    completeParts: 1, partialParts: 0, blockedParts: 0, totalParts: 1,
    confirmedDirectCostRub: 1100, allCostArticlesComplete: true, commercialPriceReady: false,
  };
  const policy: CommercialPricingPolicy = {
    metalMultiplier: 1.1, drawingPercentOfWorks: 0, finalPercent: 0,
    fixedAddRubEach: 0, fixedAddEnabled: false, roundStepRub: 0.01,
  };
  return { project, part, cost, calculation, policy };
}


async function measuredFixture(){
 const bytes=new Uint8Array(await readFile(new URL('./fixtures/cad/reference-angle.step',import.meta.url)));
 const model=await createStepCadAdapter(occtStepKernel).analyze({fileName:'reference-angle.step',format:'step',bytes});
 return model;
}
test('real bent STEP retains warnings but supplies estimate-only cost with all 50 bends priced',async()=>{
 const model=await measuredFixture();const f=fixture();
 assert.equal(verifiedBentStepCostSource(model),'measured-bent-step');
 assert.ok(model.warnings.length>0);
 f.part.format='step';f.part.geometry=model.geometry;f.part.configuration={materialId:'hot',thicknessMm:1.5,quantity:50,operations:['laser-cutting','bending'],operationInputs:{bendCount:1}};
 const source=f.cost.lines[0].source;
 const cost=calculateFactualProductionCost({materialId:'hot',thicknessMm:1.5,quantity:50,geometry:model.geometry,operations:f.part.configuration.operations,rateBook:{weldRubPerM:null,powderRubPerM2:null,laserRubPerM:[{materialId:'hot',thicknessMm:1.5,rateRub:10,pierceRubEach:1,source}],bendRubEach:{rateRub:20,source}},marketPrice:{materialId:'hot',thicknessMm:1.5,rubPerTon:100000,source:'synthetic',sourceDate:'2099-01-01',fetchedAt:'2099-01-01T00:00:00Z',exactThickness:true}});
 assert.equal(cost.status,'complete');assert.equal(cost.lines.find(line=>line.code==='bending')?.amountRubBatch,1000);
 f.calculation.parts[0].calculation=cost;
 f.calculation.parts[0].dfmReviewReasons=[...runVerifiedLaserDfm({width:model.geometry.widthMm!,height:model.geometry.heightMm!,units:'мм'},1.5,'hot').filter(x=>x.severity==='manual').map(x=>x.title),'Зоны гиба и инструмент требуют проверки технолога',...model.warnings];
 const evidence={[f.part.id]:{reviewReasons:[...model.warnings],preliminaryGeometrySource:verifiedBentStepCostSource(model)}};
 const result=await reviewCadProjectCalculation(f.project,f.calculation,evidence,f.policy,{caller:null,requireAiReview:false});
 assert.equal(result.signals[0].status,'needs-review');assert.ok(result.signals[0].estimatedSalePriceRub);assert.equal(result.signals[0].approvedSalePriceRub,null);
 assert.equal(result.audits[0].review.status,'needs-review');
 assert.deepEqual(evidence[f.part.id].reviewReasons,model.warnings);
 const noFlag=await reviewCadProjectCalculation(f.project,f.calculation,{[f.part.id]:{reviewReasons:model.warnings}},f.policy,{caller:null,requireAiReview:false});
 assert.equal(noFlag.signals[0].estimatedSalePriceRub,undefined);
});
test('bent cost source rejects unknown warnings, missing blanks, extra solids and mismatched volume',async()=>{
 const original=await measuredFixture();
 for(const mutation of ['warning','blank','solid','volume','area','reason','bends'] as const){
  const model=structuredClone(original);
  if(mutation==='warning')model.warnings.push('Unknown kernel defect');
  if(mutation==='blank')delete model.sheetMetal!.development!.blankWidthMm;
  if(mutation==='solid')model.geometry.bodyCount=2;
  if(mutation==='volume')model.geometry.volumeMm3!*=2;
  if(mutation==='area')model.geometry.areaMm2!*=2;
  if(mutation==='reason')model.sheetMetal!.development!.reasons.push('unresolved');
  if(mutation==='bends')model.geometry.bendCount=0;
  assert.equal(verifiedBentStepCostSource(model),undefined,mutation);
 }
});
