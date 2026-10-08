import {timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {NextRequest} from 'next/server';
import {employeeInstallerResponse} from '@/lib/server/employee-app/installer';
import {parseCalculationSettings} from '@/lib/employee-app/settings';
import {readJsonBody} from '@/lib/security/request-body';
import {pdSafeJson,pdSafeError} from '@/lib/pd-admin/http/safe-response';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest){try{
 const expected=process.env.STEEL_EMPLOYEE_DISTRIBUTION_KEY??'';
 const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
 if(!/^[a-f0-9]{64}$/.test(expected)||!/^[a-f0-9]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return pdSafeError('ACCESS_DENIED',403);
 const body=await readJsonBody<{action?:string}>(request,256);
 if(!body||!['bootstrap','release','download'].includes(body.action??''))return pdSafeError('INVALID_REQUEST',400);
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
 return pdSafeError('INVALID_REQUEST',400);
}catch{return pdSafeError('UNAVAILABLE',503)}}
