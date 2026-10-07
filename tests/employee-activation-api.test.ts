import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {NextRequest} from 'next/server';
import {EmployeeRegistry} from '../lib/employee-app/registry';
import {POST} from '../app/api/employee-app/activation/route';
import {POST as downloadInstaller} from '../app/api/employee-app/installer/route';
test('activation API protects private basis and release, and honours revocation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'employee-api-'));
 const old={...process.env};
 try{
 Object.assign(process.env,{STEEL_EMPLOYEE_ACTIVATION_ENABLED:'true',STEEL_EMPLOYEE_REGISTRY_PATH:join(dir,'registry.sqlite'),STEEL_EMPLOYEE_BASIS_PATH:join(dir,'basis.json'),STEEL_EMPLOYEE_SETTINGS_PATH:join(dir,'settings.json'),STEEL_EMPLOYEE_RELEASE_PATH:join(dir,'release.json'),STEEL_EMPLOYEE_UPDATE_FILE:join(dir,'SteelProdukt-Employee-0.1.0-x64.exe')});
 writeFileSync(join(dir,'settings.json'),JSON.stringify({commercial:{metalMultiplier:1,drawingPercentOfWorks:0,finalPercent:0,roundStepRub:1},metalMarketUpliftPct:0,operations:{laserRubPerM:[],bendRubEach:null,weldRubPerM:null,countersinkRubEach:null,powderRubPerM2:null,assemblyRubPerHour:null,surfacePreparationRubPerM2:null,packagingRubEach:null}}));
 writeFileSync(join(dir,'basis.json'),JSON.stringify({testRate:123}));
 writeFileSync(join(dir,'release.json'),JSON.stringify({version:'0.1.0',url:'https://www.steelprodukt.ru/downloads/employee/SteelProdukt-Employee-0.1.0-x64.exe',bytes:12,sha256:'a'.repeat(64)}));
 writeFileSync(process.env.STEEL_EMPLOYEE_UPDATE_FILE!,'MZ1234567890');
 const registry=new EmployeeRegistry(process.env.STEEL_EMPLOYEE_REGISTRY_PATH!);
 const license=registry.create('Test',1,'admin'),deviceId=randomUUID();
 const request=(body:object)=>POST(new NextRequest('https://www.steelprodukt.ru/api/employee-app/activation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await request({action:'bootstrap',token:'x'.repeat(43),deviceId})).status,403);
 const activated=await request({action:'activate',code:license.code,deviceId});assert.equal(activated.status,200);
 const {token,device}=await activated.json();
 const downloadByCode=(code:string,origin='https://www.steelprodukt.ru')=>downloadInstaller(new NextRequest('https://www.steelprodukt.ru/api/employee-app/installer',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin},body:new URLSearchParams({code})}));
 assert.equal((await downloadByCode('invalid')).status,303);
 assert.equal((await downloadByCode(license.code,'https://other.example')).status,303);
 const staffDownload=await downloadByCode(license.code);assert.equal(staffDownload.status,200);assert.equal(await staffDownload.text(),'MZ1234567890');

 const basis=await request({action:'bootstrap',token,deviceId});assert.equal(basis.status,200);assert.match(basis.headers.get('cache-control')! ,/no-store/);assert.deepEqual((await basis.json()).basis,{testRate:123});
 assert.equal((await request({action:'release',token,deviceId})).status,200);
 assert.equal((await request({action:'download',deviceId})).status,400);
 assert.equal((await request({action:'download',deviceId,token:'x'.repeat(43)})).status,403);
 assert.equal((await request({action:'download',deviceId:randomUUID(),token})).status,403);
 const download=await request({action:'download',deviceId,token});assert.equal(download.status,200);assert.match(download.headers.get('cache-control')!,/no-store/);assert.equal(await download.text(),'MZ1234567890');
 registry.revoke('device',device,'admin');
 for(const action of ['check','bootstrap','release','download'])assert.equal((await request({action,token,deviceId})).status,403);
 registry.revoke('license',license.id,'admin');assert.equal((await downloadByCode(license.code)).status,303);
 registry.close();
 process.env.STEEL_EMPLOYEE_ACTIVATION_ENABLED='false';assert.equal((await request({action:'check',token,deviceId})).status,503);
 }finally{for(const key of ['STEEL_EMPLOYEE_ACTIVATION_ENABLED','STEEL_EMPLOYEE_REGISTRY_PATH','STEEL_EMPLOYEE_BASIS_PATH','STEEL_EMPLOYEE_RELEASE_PATH','STEEL_EMPLOYEE_SETTINGS_PATH','STEEL_EMPLOYEE_UPDATE_FILE']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key]}rmSync(dir,{recursive:true,force:true})}
});
