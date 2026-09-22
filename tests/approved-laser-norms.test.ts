import assert from 'node:assert/strict';
import test from 'node:test';
import {runVerifiedLaserDfm} from '../lib/instant-quote/dfm';
import {measureVerifiedFlatFeatures} from '../lib/instant-quote/verified-flat-features';
import type {DxfShape} from '../lib/instant-quote/dxf';
const rectangle:DxfShape={kind:'polyline',closed:true,bulges:[0,0,0,0],points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}]};
const features=(diameter:number,gap:number)=>measureVerifiedFlatFeatures({units:'мм',unsupportedEntities:[],shapes:[rectangle,{kind:'circle',c:{x:gap+diameter/2,y:10},r:diameter/2}]});
const check=(diameter:number,gap:number,t=2)=>runVerifiedLaserDfm({width:20,height:20,units:'мм'},t,'cold',features(diameter,gap));
test('approved equality boundaries pass: diameter = thickness and ligament = 3 mm',()=>{
 assert.ok(check(2,3).every(r=>r.severity==='pass'));
 assert.ok(check(4,3,4).every(r=>r.severity==='pass'));
});
test('a hole or ligament below its approved minimum blocks, larger values pass',()=>{
 assert.equal(check(1.99,3).find(r=>r.code==='feature-rules')?.severity,'error');
 assert.equal(check(2,2.99).find(r=>r.code==='feature-rules')?.severity,'error');
 assert.equal(check(4,4).find(r=>r.code==='feature-rules')?.severity,'pass');
});
test('no minimum part-size norm, but working field and unknown geometry remain constrained',()=>{
 const tiny=measureVerifiedFlatFeatures({units:'мм',unsupportedEntities:[],shapes:[{...rectangle,kind:'polyline',closed:true,bulges:[],points:[{x:0,y:0},{x:0.1,y:0},{x:0.1,y:0.1},{x:0,y:0.1}]}]});
 assert.equal(runVerifiedLaserDfm({width:0.1,height:0.1,units:'мм'},2,'cold',tiny).find(r=>r.code==='feature-rules')?.severity,'pass');
 assert.equal(runVerifiedLaserDfm({width:1600,height:3100,units:'мм'},2,'cold',tiny).find(r=>r.code==='table')?.severity,'error');
 assert.equal(runVerifiedLaserDfm({width:20,height:20,units:'мм'},2,'cold').find(r=>r.code==='feature-rules')?.severity,'manual');
 assert.equal(runVerifiedLaserDfm({width:20,height:20,units:'мм'},2,'zinc',features(2,3)).find(r=>r.code==='material-thickness-review')?.severity,'manual');
});
