import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {NextRequest} from 'next/server';
import {POST} from '../app/api/employee-app/feed/route';
test('distribution feed protects private updates without computer activation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'employee-feed-')),old={...process.env};
 const keys=['STEEL_EMPLOYEE_DISTRIBUTION_KEY','STEEL_EMPLOYEE_BASIS_PATH','STEEL_EMPLOYEE_SETTINGS_PATH','STEEL_EMPLOYEE_RELEASE_PATH','STEEL_EMPLOYEE_UPDATE_FILE'];
 try{
 Object.assign(process.env,{STEEL_EMPLOYEE_DISTRIBUTION_KEY:'a'.repeat(64),STEEL_EMPLOYEE_BASIS_PATH:join(dir,'basis.json'),STEEL_EMPLOYEE_SETTINGS_PATH:join(dir,'settings.json'),STEEL_EMPLOYEE_RELEASE_PATH:join(dir,'release.json'),STEEL_EMPLOYEE_UPDATE_FILE:join(dir,'SteelProdukt-Employee-0.1.0-x64.exe')});
 writeFileSync(join(dir,'settings.json'),JSON.stringify({commercial:{metalMultiplier:1,drawingPercentOfWorks:0,finalPercent:0,roundStepRub:1},metalMarketUpliftPct:0,operations:{laserRubPerM:[],bendRubEach:null,weldRubPerM:null,countersinkRubEach:null,powderRubPerM2:null,assemblyRubPerHour:null,surfacePreparationRubPerM2:null,packagingRubEach:null}}));
 writeFileSync(join(dir,'basis.json'),JSON.stringify({testRate:123}));
 writeFileSync(join(dir,'release.json'),JSON.stringify({version:'0.1.0',url:'https://www.steelprodukt.ru/downloads/employee/SteelProdukt-Employee-0.1.0-x64.exe',bytes:12,sha256:'a'.repeat(64)}));
 writeFileSync(process.env.STEEL_EMPLOYEE_UPDATE_FILE!,'MZ1234567890');

 const request=(action:string,key='a'.repeat(64))=>POST(new NextRequest('https://www.steelprodukt.ru/api/employee-app/feed',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({action})}));
 for(const key of ['', 'b'.repeat(64),'é'.repeat(64)])assert.equal((await request('bootstrap',key)).status,403);
 const basis=await request('bootstrap');assert.equal(basis.status,200);assert.deepEqual((await basis.json()).basis,{testRate:123});
 assert.equal((await request('release')).status,200);
 const download=await request('download');assert.equal(download.status,200);assert.equal(await download.text(),'MZ1234567890');assert.match(download.headers.get('cache-control')!,/no-store/);
 assert.equal((await request('activate')).status,400);
 }finally{for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key]}rmSync(dir,{recursive:true,force:true})}
});
