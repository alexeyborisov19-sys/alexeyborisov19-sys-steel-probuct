import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultBasketWallAssembly, validBasketWallAssembly} from '../lib/quote/basket-wall-assembly';
import {defaultBasketDesign,basketDesignSummary} from '../lib/quote/basket-design';
import {basketMountingDimensions} from '../lib/quote/basket-mounting';
import {serializeBasketProject,parseBasketProject} from '../lib/quote/basket-project';

test('insulation is descriptive and does not add a second facade layer',()=>{
 const design={...defaultBasketDesign(),wallKind:'ventilated' as const,facade:200,offset:100,wallAssembly:{...defaultBasketWallAssembly(),structuralBase:'concrete' as const,finish:'cladding' as const,insulation:'yes' as const,insulationThicknessMm:150}};
 assert.equal(basketMountingDimensions(design).wallToBlockRearMm,300);
 const item={width:900,height:600,depth:550,quantity:1,ral:'7024',screen:'round',design};
 const restored=parseBasketProject(serializeBasketProject([item]))[0].design!;
 assert.deepEqual(restored.wallAssembly,design.wallAssembly);assert.equal(basketMountingDimensions(restored).wallToBlockRearMm,300);
 assert.match(basketDesignSummary(restored),/не прибавляется повторно/);assert.match(basketDesignSummary(restored),/анкеры и кронштейны подбирает инженер/);
});
test('unknown structure stays unknown; invalid and contradictory insulation is rejected',()=>{
 assert.equal(validBasketWallAssembly(defaultBasketWallAssembly()),true);
 for(const thickness of [NaN,Infinity,-1,2001])assert.equal(validBasketWallAssembly({...defaultBasketWallAssembly(),insulationThicknessMm:thickness}),false);
 assert.equal(validBasketWallAssembly({...defaultBasketWallAssembly(),insulation:'no',insulationThicknessMm:150}),false);
 assert.equal(validBasketWallAssembly({...defaultBasketWallAssembly(),structuralBase:'approved'}),false);
});
