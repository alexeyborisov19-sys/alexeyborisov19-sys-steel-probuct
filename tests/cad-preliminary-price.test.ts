import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject, type InstantQuoteProject, type ProjectPart } from "../lib/instant-quote/domain";
import type { FactualCalculationResult, FactualCalculationLine } from "../lib/instant-quote/factual-calculation";
import type { ProjectFactualCalculationResult } from "../lib/instant-quote/project-factual-calculation";
import type { CommercialPricingPolicy } from "../lib/server/instant-quote/commercial-pricing";
import { createClientCalculationView } from "../lib/instant-quote/client-calculation-view";
import { reviewCadProjectCalculation } from "../lib/server/quote-engine/cad-stage-review";
import { runVerifiedLaserDfm } from "../lib/instant-quote/dfm";
import { isClientCalculationView } from "../lib/instant-quote/client-api-contracts";


// Synthetic test rates, never production pricing.
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

function reviewFixture() {
 const f=fixture();
 f.calculation.parts[0].dfmReviewReasons=runVerifiedLaserDfm({width:100,height:100,units:"мм"},1,"hot").filter(x=>x.severity==="manual").map(x=>x.title);
 return f;
}
test("complete cost with manufacturing-only review yields estimate, never approval or confidential cost",async()=>{
 const f=reviewFixture();
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{},f.policy,{caller:null,requireAiReview:false});
 assert.equal(result.signals[0].status,"needs-review");
 assert.equal(result.signals[0].estimatedSalePriceRub,1200);
 assert.equal(result.signals[0].approvedSalePriceRub,null);
 assert.equal(result.signals[0].aiReviewed,false);
 assert.equal(result.audits[0].publishedRubBatch,null);
 const view=createClientCalculationView(f.project,result.signals);
 assert.equal(view.parts[0].price.status,"estimate");
 assert.equal(view.paymentEnabled,false);
 assert.match(view.parts[0].message,/инженер/);
 assert.doesNotMatch(JSON.stringify(view),/private-fixture-rate|rateRub|confirmedDirectCost|1100/);
 assert.equal(isClientCalculationView(view),true);
});
for(const mode of ["blocked","partial","unknown-review","unsupported","ai-required","missing-geometry","unconfirmed-material"] as const) test(`estimate stays hidden for ${mode}`,async()=>{
 const f=reviewFixture();
 const evidence: Record<string,{reviewReasons?:string[];unsupportedEntities?:string[]}>={};
 if(mode==="blocked")f.calculation.parts[0].dfmBlockingReasons=["Too small hole"];
 if(mode==="partial")f.cost.status="partial";
 if(mode==="unknown-review")evidence[f.part.id]={reviewReasons:["Ambiguous thickness"]};
 if(mode==="unsupported")evidence[f.part.id]={unsupportedEntities:["SPLINE"]};
 if(mode==="missing-geometry")delete f.part.geometry!.cutLengthMm;
 if(mode==="unconfirmed-material"){f.cost.materialId="inox";f.part.configuration.materialId="inox";}
 const result=await reviewCadProjectCalculation(f.project,f.calculation,evidence,f.policy,{caller:null,requireAiReview:mode==="ai-required"});
 assert.equal(result.signals[0].estimatedSalePriceRub,undefined);
 assert.equal(createClientCalculationView(f.project,result.signals).parts[0].price.status,"not-published");
});
test("client DTO refuses stale estimate in blocked or ready state",()=>{
 const f=fixture();
 for(const status of ["blocked","ready"] as const){
  const view=createClientCalculationView(f.project,[{partId:f.part.id,status,estimatedSalePriceRub:1200}]);
  assert.equal(view.parts[0].price.status,"not-published");
 }
 const view=createClientCalculationView(f.project,[{partId:f.part.id,status:"needs-review",estimatedSalePriceRub:1200}]);
 view.parts[0].status="ready";
 assert.equal(isClientCalculationView(view),false);
});

for (const reply of ['{"status":"passed"}', '{"status":"needs-review"}', '{"status":"passed","price":1}', null]) test(`required cost-only AI review: ${reply}`,async()=>{
 const f=reviewFixture();
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{},f.policy,{requireAiReview:true,preliminaryPriceCaller:async()=>reply});
 assert.equal(result.signals[0].estimatedSalePriceRub,reply==='{"status":"passed"}'?1200:undefined);
 assert.equal(result.signals[0].status,"needs-review");
 assert.notEqual(result.signals[0].aiReviewed,true);
 assert.equal(result.audits[0].review.status,"needs-review");
 assert.equal(result.audits[0].publishedRubBatch,null);
});

test("priced bending and complex-contour manual review retain a visible estimate",async()=>{
 const f=reviewFixture();
 f.part.configuration.operations.push("bending");
 f.part.configuration.operationInputs={bendCount:2};
 f.cost.parameters.bendCountEach=2;
 f.cost.lines.push({...f.cost.lines[1],code:"bending",rateRub:20,amountRubEach:20,amountRubBatch:200});
 f.cost.confirmedDirectCostRubBatch=1300;
 f.cost.confirmedDirectCostRubEach=130;
 f.calculation.parts[0].dfmReviewReasons.push("Зоны гиба и инструмент требуют проверки технолога");
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{},f.policy,{caller:null,requireAiReview:false});
 assert.equal(result.signals[0].estimatedSalePriceRub,1400);
 assert.equal(result.signals[0].status,"needs-review");
});
test("inconsistent cost article arithmetic cannot produce an estimate",async()=>{
 const f=reviewFixture(); f.cost.confirmedDirectCostRubBatch=1090;
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{},f.policy,{caller:null,requireAiReview:false});
 assert.equal(result.signals[0].estimatedSalePriceRub,undefined);
});

test("galvanized material capability review permits only an estimate from complete matching rates",async()=>{
 const f=reviewFixture();
 f.cost.materialId="zinc"; f.part.configuration.materialId="zinc";
 f.calculation.parts[0].dfmReviewReasons=runVerifiedLaserDfm({width:100,height:100,units:"мм"},1,"zinc").filter(x=>x.severity==="manual").map(x=>x.title);
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{},f.policy,{caller:null,requireAiReview:false});
 assert.equal(result.signals[0].estimatedSalePriceRub,1200);
 assert.equal(result.signals[0].approvedSalePriceRub,null);
 assert.equal(result.signals[0].status,"needs-review");
 assert.equal(result.audits[0].review.status,"needs-review");
});
test("galvanized material without matching complete laser rates has no estimate",async()=>{
 const f=reviewFixture();
 f.cost.materialId="zinc"; f.part.configuration.materialId="zinc";
 f.cost.lines=f.cost.lines.filter(line=>line.code!=="laser-cutting");
 f.calculation.parts[0].dfmReviewReasons=runVerifiedLaserDfm({width:100,height:100,units:"мм"},1,"zinc").filter(x=>x.severity==="manual").map(x=>x.title);
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{},f.policy,{caller:null,requireAiReview:false});
 assert.equal(result.signals[0].estimatedSalePriceRub,undefined);
});

for (const missing of ["laser-rate", "material-price", "material-price-stale", "bend-count", "operation-rate"] as const) test(`missing ${missing} yields safe fixed public guidance`,async()=>{
 const f=fixture();f.cost.status="partial";f.cost.missing=[{code:missing,label:"SECRET-TARIFF",reason:"SECRET-RATE 987654",blocking:false}];
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{},f.policy,{caller:null,requireAiReview:false});
 const view=createClientCalculationView(f.project,result.signals);
 assert.equal(view.parts[0].price.status,"not-published");
 assert.doesNotMatch(view.parts[0].message,/SECRET|987654/);
 assert.match(view.parts[0].message,missing==="laser-rate"?/тариф лазерной резки/:missing==="material-price-stale"?/устарела/:missing==="material-price"?/цены металла/:missing==="bend-count"?/параметры/:/тариф/);
});
test("derived rate alone can never become an approved price",async()=>{
 const f=fixture();f.cost.estimatedRateUsed=true;
 const features={supported:true,reasons:[],holeCount:0,minHoleDiameterMm:null,minLigamentMm:null,minPartSideMm:100};
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{[f.part.id]:{flatFeatures:features}},f.policy,{caller:null,requireAiReview:false});
 assert.equal(result.signals[0].status,"needs-review");assert.equal(result.signals[0].approvedSalePriceRub,null);
 assert.equal(result.signals[0].estimatedRateUsed,true);
 const view=createClientCalculationView(f.project,result.signals);
 assert.equal(view.parts[0].price.status,"estimate");assert.match(view.parts[0].message,/по соседним толщинам/);
});
test("50-piece batch rounding uses exact line products and AI batch amounts",async()=>{
 const f=reviewFixture();f.part.configuration.quantity=50;f.cost.quantity=50;
 f.cost.lines[1].rateRub=0.3333;f.cost.lines[1].amountRubEach=0.33;
 f.cost.lines[0].amountRubBatch=5000;f.cost.lines[1].amountRubBatch=16.67;
 f.cost.confirmedDirectCostRubBatch=5016.67;
 let snapshot:Record<string,unknown>|undefined;
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{},f.policy,{requireAiReview:true,preliminaryPriceCaller:async evidence=>{snapshot=evidence;return '{"status":"passed"}';}});
 assert.ok(result.signals[0].estimatedSalePriceRub);
 assert.deepEqual(snapshot?.amountsRubBatch,[5000,16.67]);assert.equal(snapshot?.amountsRubEach,undefined);
});
for(const topology of ["verified","unknown","invalid"] as const)test(`concave estimate topology ${topology}`,async()=>{
 const f=fixture();
 const features={supported:false,reasons:["Contour needs engineering review"],holeCount:0,minHoleDiameterMm:null,minLigamentMm:null,minPartSideMm:100,...(topology==="verified"?{topologyVerified:true as const}:{}),...(topology==="invalid"?{invalidGeometry:true as const}:{})};
 f.calculation.parts[0].dfmReviewReasons=runVerifiedLaserDfm({width:100,height:100,units:"мм"},1,"hot",features).filter(x=>x.severity==="manual").map(x=>x.title);
 // Derived-price branch must also refuse invalid topology even when no manual remains.
 f.cost.estimatedRateUsed=true;
 const result=await reviewCadProjectCalculation(f.project,f.calculation,{[f.part.id]:{flatFeatures:features}},f.policy,{caller:null,requireAiReview:false});
 assert.equal(Boolean(result.signals[0].estimatedSalePriceRub),topology==="verified");
});
