import assert from 'node:assert/strict';
import test from 'node:test';
import {analyzeSheetMetalTopology, type SheetMetalTopologyObservations} from '../lib/instant-quote/sheet-metal';
function prism(t=2):SheetMetalTopologyObservations {
 const xy=18,area=xy*xy,side=xy*t;
 return {otherFaceCount:0,cylindricalFaces:[],planarFaces:[
  {id:'top',areaMm2:area,centerMm:[0,0,t],normal:[0,0,1],uvSizeMm:[xy,xy],boundaryLengthMm:4*xy,wireCount:1,edgeHashes:[1,2,3,4]},
  {id:'bottom',areaMm2:area,centerMm:[0,0,0],normal:[0,0,-1],uvSizeMm:[xy,xy],boundaryLengthMm:4*xy,wireCount:1,edgeHashes:[5,6,7,8]},
  {id:'left',areaMm2:side,centerMm:[-9,0,t/2],normal:[-1,0,0],edgeHashes:[1,5,9,10]},
  {id:'right',areaMm2:side,centerMm:[9,0,t/2],normal:[1,0,0],edgeHashes:[2,6,11,12]},
  {id:'front',areaMm2:side,centerMm:[0,-9,t/2],normal:[0,-1,0],edgeHashes:[3,7,9,11]},
  {id:'back',areaMm2:side,centerMm:[0,9,t/2],normal:[0,1,0],edgeHashes:[4,8,10,12]},
 ]};
}
for(const t of [2,5,10])test(`exact ${t} mm prism is recognized without sheet slenderness assumptions`,()=>{
 const result=analyzeSheetMetalTopology(prism(t),{volumeMm3:324*t});
 assert.equal(result.thicknessCandidate?.confidence,'medium');assert.equal(result.thicknessCandidate?.thicknessMm,t);
 assert.equal(result.flatPatternCandidate?.areaMm2,324);assert.equal(result.flatPatternCandidate?.cutLengthMm,72);
});
for(const mutation of ['volume','area','slope','missing-wall','disconnected','shifted-face','unsupported-wall'] as const)test(`small prism proof fails closed for ${mutation}`,()=>{
 const o=prism(2);let volume=648;
 if(mutation==='volume')volume-=10;
 if(mutation==='area')o.planarFaces[2].areaMm2-=1;
 if(mutation==='slope')o.planarFaces[2].normal=[-1,0,.01];
 if(mutation==='missing-wall')o.planarFaces.pop();
 if(mutation==='disconnected')o.planarFaces[2].edgeHashes=[91,92,93,94];
 if(mutation==='shifted-face')o.planarFaces[1].centerMm=[.1,0,0];
 if(mutation==='unsupported-wall')o.otherFaceCount=1;
 assert.equal(analyzeSheetMetalTopology(o,{volumeMm3:volume}).flatPatternCandidate,undefined);
});
test('kernel-proven exact extrusion accepts unsupported side primitives only with reconciled evidence',()=>{
 const o=prism(2);o.otherFaceCount=1;
 const proof={faceId:'top',oppositeFaceId:'bottom',thicknessMm:2};
 assert.equal(analyzeSheetMetalTopology(o,{volumeMm3:648,verifiedPrism:proof}).flatPatternCandidate?.areaMm2,324);
 for(const change of [{faceId:'absent'},{oppositeFaceId:'top'},{thicknessMm:3}])assert.equal(analyzeSheetMetalTopology(o,{volumeMm3:648,verifiedPrism:{...proof,...change}}).flatPatternCandidate,undefined);
 assert.equal(analyzeSheetMetalTopology(o,{volumeMm3:640,verifiedPrism:proof}).flatPatternCandidate,undefined);
});
