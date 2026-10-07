import {employeeInstallerResponse} from '@/lib/server/employee-app/installer';
import {parseCalculationSettings} from '@/lib/employee-app/settings';
import {readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {NextRequest} from 'next/server';
import {ActivationError,openEmployeeRegistry} from '@/lib/employee-app/registry';
import {readJsonBody,PayloadTooLargeError} from '@/lib/security/request-body';
import {pdSafeJson,pdSafeError} from '@/lib/pd-admin/http/safe-response';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 let registry;
 try{
  registry=openEmployeeRegistry();
  if(!request.headers.get('content-type')?.startsWith('application/json'))return pdSafeError('INVALID_REQUEST',400);
  // This API uses bearer/device credentials, never administrator cookies.
  const body=await readJsonBody<{action?:unknown;code?:unknown;deviceId?:unknown;token?:unknown}>(request,4096);
  if(!body||typeof body!=='object'||Array.isArray(body))return pdSafeError('INVALID_REQUEST',400);
  if(typeof body.deviceId!=='string'||!/^[a-f0-9-]{36}$/.test(body.deviceId))return pdSafeError('INVALID_REQUEST',400);
  // Do not trust arbitrary proxy headers for a device throttle. Codes have 192 bits of entropy.
  registry.limit('global',Date.now(),1000);
  registry.limit('device:'+body.deviceId);
  if(body.action==='activate'&&typeof body.code==='string'){
   registry.limit('code:'+body.code.slice(0,64));
   return pdSafeJson({ok:true,...registry.activate(body.code,body.deviceId),checkAfterSeconds:300});
  }
  if((body.action==='check'||body.action==='bootstrap'||body.action==='release'||body.action==='download')&&typeof body.token==='string'){
   if(!registry.check(body.token,body.deviceId))return pdSafeError('ACCESS_REVOKED',403);
   if(body.action==='download')return await employeeInstallerResponse();
   if(body.action==='release'){
    const path=process.env.STEEL_EMPLOYEE_RELEASE_PATH;
    if(!path||!isAbsolute(path))return pdSafeJson({ok:true,release:null});
    const raw=await readFile(path,'utf8');
    if(Buffer.byteLength(raw)>4096)return pdSafeError('UNAVAILABLE',503);
    const release=JSON.parse(raw);
    if(!/^\d+\.\d+\.\d+$/.test(release.version)||!/^https:\/\/www\.steelprodukt\.ru\/downloads\/employee\/SteelProdukt-Employee-\d+\.\d+\.\d+-x64\.exe$/.test(release.url)||!Number.isSafeInteger(release.bytes)||release.bytes<1||release.bytes>1_000_000_000||!/^[a-f0-9]{64}$/.test(release.sha256))return pdSafeError('UNAVAILABLE',503);
    return pdSafeJson({ok:true,release:{version:release.version,url:release.url,bytes:release.bytes,sha256:release.sha256}});
   }
   if(body.action==='bootstrap'){
    const path=process.env.STEEL_EMPLOYEE_BASIS_PATH;
    if(!path||!isAbsolute(path))return pdSafeError('UNAVAILABLE',503);
    const raw=await readFile(path,'utf8');
    if(Buffer.byteLength(raw)>5_000_000)return pdSafeError('UNAVAILABLE',503);
    const basis=JSON.parse(raw);
    const settingsPath=process.env.STEEL_EMPLOYEE_SETTINGS_PATH;
    if(!settingsPath||!isAbsolute(settingsPath))return pdSafeError('UNAVAILABLE',503);
    const settingsRaw=await readFile(settingsPath,'utf8');
    if(Buffer.byteLength(settingsRaw)>512000)return pdSafeError('UNAVAILABLE',503);
    const settings=parseCalculationSettings(JSON.parse(settingsRaw));
    return pdSafeJson({ok:true,basis,settings});
   }
   return pdSafeJson({ok:true,checkAfterSeconds:300});
  }
  return pdSafeError('INVALID_REQUEST',400);
 }catch(e){if(e instanceof PayloadTooLargeError)return pdSafeError('INVALID_REQUEST',413);if(e instanceof SyntaxError)return pdSafeError('INVALID_REQUEST',400);return pdSafeError(e instanceof ActivationError?e.message:'UNAVAILABLE',e instanceof ActivationError&&e.message==='RATE_LIMIT'?429:e instanceof ActivationError&&e.message!=='UNAVAILABLE'?403:503)}finally{registry?.close()}
}
