import './repo-alias-hook.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEmptyProject,type ManufacturingOperation} from '../lib/instant-quote/domain';
import {addPartToProject} from '../lib/instant-quote/project';
import {manualSheetGeometry,MANUAL_SHEET_WARNING} from '../lib/instant-quote/manual-sheet';
import type {ProjectCadEvidence} from '../lib/instant-quote/project-factual-calculation';

async function main(){
 const q=JSON.parse(fs.readFileSync('/private/tmp/steel-working-qa.json','utf8'));
 for(const key of ['STEEL_PRODUCT_PRIVATE_CALCULATION_BASIS_PATH','STEEL_PRODUCT_PRIVATE_PRODUCTION_REPORT_ROOT'])assert.ok(q.environment[key]?.startsWith('/private/tmp/'));
 Object.assign(process.env,q.environment,{STEEL_PRODUCT_QUOTE_AI_REVIEW_REQUIRED:'false',STEEL_PRODUCT_LOCAL_AI_ENABLED:'false'});
 const {runConfidentialCalculationForClient}=await import('../lib/server/instant-quote/run-confidential-calculation');
 const services:ManufacturingOperation[]=['bending','welding','countersink','powder-coating','assembly','surface-preparation','packaging'];
 let checked=0;
 for(const materialId of ['cold','hot','zinc'])for(const quantity of [1,50])for(let start=0;start<128;start+=5){
  let project=createEmptyProject(new Date());const evidence:ProjectCadEvidence={};const sides:Record<string,1|2>={},factual:Record<string,{bendCount:number;weldLengthM:number;countersinkCount:number;assemblyMinutes:number}>={};
  for(let mask=start;mask<Math.min(128,start+5);mask++){
   project=addPartToProject(project,{fileName:`synthetic-${mask}.dxf`,fileSizeBytes:100},new Date(Date.now()+mask));const part=project.parts.at(-1)!;
   part.geometry=manualSheetGeometry({lengthMm:400,widthMm:350,holes:true,holeGroups:Array.from({length:5},(_,i)=>({count:i+1,diameterMm:5+i*2}))});
   part.configuration={materialId,thicknessMm:2,quantity,operations:['laser-cutting',...services.filter((_,i)=>mask&(1<<i))],operationInputs:{bendCount:2,weldLengthM:.3,countersinkCount:3,assemblyMinutes:4,powderSides:2,surfacePreparationSides:2}};part.state='manual-review';
   evidence[part.id]={preliminaryGeometrySource:'manual-rectangular-blank',reviewReasons:[MANUAL_SHEET_WARNING]};sides[part.id]=2;factual[part.id]={bendCount:2,weldLengthM:.3,countersinkCount:3,assemblyMinutes:4};
  }
  const value=await runConfidentialCalculationForClient(project,evidence,{publicEstimate:true,factualByPartId:factual,powderSidesByPartId:sides,surfacePreparationSidesByPartId:sides});
  for(const part of value.parts){assert.equal(part.price.status,'estimate',`${materialId}, ${quantity}, ${part.fileName}: ${part.message}`);assert.ok(part.price.totalRub!>0);assert.equal(part.price.unpricedOperations,undefined,`${part.fileName}: missing service`);checked++;}
  assert.doesNotMatch(JSON.stringify(value),/rateRub|rubPerTon|metalMultiplier|confirmedDirectCost/);
 }
 assert.equal(checked,768);console.log('PASS 768 private-basis public estimates: 128 service combinations, three materials, quantities 1/50, five hole groups, all services priced; no confidential fields');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
