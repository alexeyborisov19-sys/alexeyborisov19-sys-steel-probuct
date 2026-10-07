/** Synthetic activation smoke; never prints credentials or private prices. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {openEmployeeRegistry} from '../lib/employee-app/registry';
async function main(){
 const registry=openEmployeeRegistry();const license=registry.create('Проверка выпуска (автоматическая)',1,'release-verification');
 const deviceId=randomUUID();let token='';
 async function request(body:object){return fetch('https://www.steelprodukt.ru/api/employee-app/activation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,deviceId}),redirect:'error',signal:AbortSignal.timeout(15000)})}
 try{
  const activated=await request({action:'activate',code:license.code});assert.equal(activated.status,200);token=(await activated.json()).token;
  const bootstrap=await request({action:'bootstrap',token});assert.equal(bootstrap.status,200);const initial=await bootstrap.json();assert(initial.basis?.rateBook&&initial.settings?.operations&&initial.settings?.commercial);
  const release=await request({action:'release',token});assert.equal(release.status,200);const metadata=(await release.json()).release;assert(metadata?.sha256);
  const download=await request({action:'download',token});assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'private, no-store');
  const hash=createHash('sha256');let bytes=0;for await(const chunk of download.body!){hash.update(chunk);bytes+=chunk.length}assert.equal(bytes,metadata.bytes);assert.equal(hash.digest('hex'),metadata.sha256);
  const raw=await fetch(metadata.url);assert.equal(raw.status,404);
  const form=await fetch('https://www.steelprodukt.ru/api/employee-app/installer',{method:'POST',headers:{Origin:'https://www.steelprodukt.ru','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:license.code}),redirect:'manual'});assert.equal(form.status,200);await form.body?.cancel();
 }finally{registry.revoke('license',license.id,'release-verification');registry.close()}
 if(token)assert.equal((await request({action:'download',token})).status,403);
 console.log('Employee activation, initial settings, protected download, checksum and revocation: verified. Synthetic license disabled.');
}
main().catch(()=>{console.error('Employee release verification failed; inspect service configuration. No activation secret was logged.');process.exitCode=1});
