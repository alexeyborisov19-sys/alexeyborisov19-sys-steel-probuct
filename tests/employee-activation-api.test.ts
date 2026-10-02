import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {NextRequest} from 'next/server';
import {EmployeeRegistry} from '../lib/employee-app/registry';
import {POST} from '../app/api/employee-app/activation/route';
test('activation API protects private basis and release, and honours revocation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'employee-api-'));
 const old={...process.env};
 try{
 Object.assign(process.env,{STEEL_EMPLOYEE_ACTIVATION_ENABLED:'true',STEEL_EMPLOYEE_REGISTRY_PATH:join(dir,'registry.sqlite'),STEEL_EMPLOYEE_BASIS_PATH:join(dir,'basis.json'),STEEL_EMPLOYEE_SETTINGS_PATH:join(dir,'settings.json'),STEEL_EMPLOYEE_RELEASE_PATH:join(dir,'release.json')});
 writeFileSync(join(dir,'settings.json'),JSON.stringify({commercial:{metalMultiplier:1,drawingPercentOfWorks:0,finalPercent:0,roundStepRub:1},metalMarketUpliftPct:0,operations:{laserRubPerM:[],bendRubEach:null,weldRubPerM:null,countersinkRubEach:null,powderRubPerM2:null,assemblyRubPerHour:null,surfacePreparationRubPerM2:null,packagingRubEach:null}}));
 writeFileSync(join(dir,'basis.json'),JSON.stringify({testRate:123}));
 writeFileSync(join(dir,'release.json'),JSON.stringify({version:'0.1.0',url:'https://www.steelprodukt.ru/downloads/employee/SteelProdukt-Employee-0.1.0-x64.exe',bytes:12,sha256:'a'.repeat(64)}));
 const registry=new EmployeeRegistry(process.env.STEEL_EMPLOYEE_REGISTRY_PATH!);
 const license=registry.create('Test',1,'admin'),deviceId=randomUUID();
 const request=(body:object)=>POST(new NextRequest('https://www.steelprodukt.ru/api/employee-app/activation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await request({action:'bootstrap',token:'x'.repeat(43),deviceId})).status,403);
 const activated=await request({action:'activate',code:license.code,deviceId});assert.equal(activated.status,200);
 const {token,device}=await activated.json();
 const basis=await request({action:'bootstrap',token,deviceId});assert.equal(basis.status,200);assert.match(basis.headers.get('cache-control')! ,/no-store/);assert.deepEqual((await basis.json()).basis,{testRate:123});
 assert.equal((await request({action:'release',token,deviceId})).status,200);
 registry.revoke('device',device,'admin');
 for(const action of ['check','bootstrap','release'])assert.equal((await request({action,token,deviceId})).status,403);
 registry.close();
 process.env.STEEL_EMPLOYEE_ACTIVATION_ENABLED='false';assert.equal((await request({action:'check',token,deviceId})).status,503);
 }finally{for(const key of ['STEEL_EMPLOYEE_ACTIVATION_ENABLED','STEEL_EMPLOYEE_REGISTRY_PATH','STEEL_EMPLOYEE_BASIS_PATH','STEEL_EMPLOYEE_RELEASE_PATH','STEEL_EMPLOYEE_SETTINGS_PATH']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key]}rmSync(dir,{recursive:true,force:true})}
});
