import assert from 'node:assert/strict';
import test from 'node:test';
import {createManualSheetDxf,readManualSheetDxf,manualSheetGeometry,MANUAL_SHEET_WARNING} from '../lib/instant-quote/manual-sheet';
import {dxfCadAdapter} from '../lib/instant-quote/dxf-adapter';
import {parseAsciiDxf} from '../lib/instant-quote/dxf';
import {createClientCadPreview} from '../lib/instant-quote/client-cad-preview';
const input={lengthMm:400,widthMm:350,holes:true,holeCount:4,holeDiameterMm:10};
test('declared manual holes add measured perimeter/pierces and subtract only net area; no hole positions invented',async()=>{
 const dxf=createManualSheetDxf(input);assert.deepEqual(readManualSheetDxf(dxf),input);
 const model=await dxfCadAdapter.analyze({fileName:'manual.dxf',format:'dxf',bytes:new TextEncoder().encode(dxf)});
 assert.equal(model.geometry.blankAreaMm2,140000);
 assert.ok(Math.abs(model.geometry.areaMm2!-(140000-100*Math.PI))<1e-8);
 assert.ok(Math.abs(model.geometry.cutLengthMm!-(1500+40*Math.PI))<1e-8);
 assert.equal(model.geometry.pierceCount,5);assert.equal(model.geometry.holeCount,4);
 const preview=createClientCadPreview(model,parseAsciiDxf(dxf));
 assert.equal(preview.status,'needs-review');assert.equal(preview.message,MANUAL_SHEET_WARNING);
 assert.equal(preview.drawing?.polylines.length,1);
 assert.equal(manualSheetGeometry({...input,holes:false,holeCount:0,holeDiameterMm:0}).cutLengthMm,1500);
});
test('manual declaration rejects impossible inputs, hidden holes and changed geometry rather than pricing a different part',()=>{
 for(const bad of [{...input,lengthMm:0},{...input,widthMm:Infinity},{...input,holeCount:1.5},{...input,holeDiameterMm:350},{...input,holeCount:100000},{...input,holes:false},{...input,lengthMm:1e308}])assert.throws(()=>createManualSheetDxf(bad));
 const dxf=createManualSheetDxf(input);
 assert.throws(()=>readManualSheetDxf(dxf.replace('10\n400','10\n399')));
 assert.throws(()=>readManualSheetDxf(dxf.replace('"lengthMm":400','"lengthMm":401')));
 assert.deepEqual(readManualSheetDxf(dxf.replaceAll('\n','\r\n')),input);
 assert.equal(readManualSheetDxf('0\nSECTION\n2\nHEADER\n0\nEOF'),null);
});

test('multiple hole types sum each perimeter, area and pierce without inventing positions',async()=>{
 const grouped={lengthMm:400,widthMm:350,holes:true,holeGroups:[{count:4,diameterMm:10},{count:2,diameterMm:20}]};
 const dxf=createManualSheetDxf(grouped);assert.match(dxf,/MANUAL_BLANK_V2:/);assert.deepEqual(readManualSheetDxf(dxf),grouped);
 const model=await dxfCadAdapter.analyze({fileName:'groups.dxf',format:'dxf',bytes:new TextEncoder().encode(dxf)});
 assert.ok(Math.abs(model.geometry.areaMm2!-(140000-300*Math.PI))<1e-8);
 assert.ok(Math.abs(model.geometry.cutLengthMm!-(1500+80*Math.PI))<1e-8);
 assert.equal(model.geometry.holeCount,6);assert.equal(model.geometry.pierceCount,7);assert.equal(model.geometry.blankAreaMm2,140000);
 assert.equal(createClientCadPreview(model,parseAsciiDxf(dxf)).drawing?.polylines.length,1);
 const none={...grouped,holes:false,holeGroups:[]};assert.equal(manualSheetGeometry(none).holeCount,0);
 assert.deepEqual(readManualSheetDxf(createManualSheetDxf(none)),none);
});
test('group declarations reject invalid rows, hidden types, excessive totals, version mismatch and tampering',()=>{
 const grouped={lengthMm:10000,widthMm:10000,holes:true,holeGroups:[{count:1,diameterMm:1}]};
 for(const bad of [{...grouped,holeGroups:[]},{...grouped,holes:false},{...grouped,holeGroups:[{count:0,diameterMm:1}]},{...grouped,holeGroups:[{count:1,diameterMm:NaN}]},{...grouped,holeGroups:Array.from({length:6},()=>({count:1,diameterMm:1}))},{...grouped,holeGroups:[{count:1,diameterMm:1,rate:100}]}])assert.throws(()=>createManualSheetDxf(bad));
 const maximum={...grouped,holeGroups:Array.from({length:5},()=>({count:1000,diameterMm:1}))};assert.deepEqual(readManualSheetDxf(createManualSheetDxf(maximum)),maximum);
 const dxf=createManualSheetDxf(grouped);assert.throws(()=>readManualSheetDxf(dxf.replace('_V2:','_V1:')));assert.throws(()=>readManualSheetDxf(dxf.replace('_V2:','_V3:')));assert.throws(()=>readManualSheetDxf(dxf.replace('10\n10000','10\n10001')));
});

test('public manual input accepts large quantities per diameter without creating per-hole objects',()=>{
 const value={lengthMm:10000,widthMm:10000,holes:true,holeGroups:[{count:200000,diameterMm:1}]};
 assert.equal(manualSheetGeometry(readManualSheetDxf(createManualSheetDxf(value))!).holeCount,200000);
});
