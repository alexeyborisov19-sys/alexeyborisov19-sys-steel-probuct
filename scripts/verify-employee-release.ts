/** Synthetic activation smoke; never prints credentials or private prices. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openEmployeeRegistry} from '../lib/employee-app/registry';
async function main(){
 const registry=openEmployeeRegistry();const license=registry.create('Проверка выпуска (автоматическая)',1,'release-verification');
 const deviceId=randomUUID();let token='';
 async function request(body:object){return fetch('https://www.steelprodukt.ru/api/employee-app/activation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,deviceId}),redirect:'error',signal:AbortSignal.timeout(15000)})}
 try{
  const activated=await request({action:'activate',code:license.code});assert.equal(activated.status,200);token=(await activated.json()).token;
  const bootstrap=await request({action:'bootstrap',token});assert.equal(bootstrap.status,200);const initial=await bootstrap.json();assert(initial.basis?.rateBook&&initial.settings?.operations&&initial.settings?.commercial);
  const release=await request({action:'release',token});assert.equal(release.status,200);assert((await release.json()).release?.sha256);
 }finally{registry.revoke('license',license.id,'release-verification');registry.close()}
 if(token)assert.equal((await request({action:'check',token})).status,403);
 console.log('Employee activation, initial settings, release metadata and revocation: verified. Synthetic license disabled.');
}
main().catch(()=>{console.error('Employee release verification failed; inspect service configuration. No activation secret was logged.');process.exitCode=1});
