import {assertAdministrativeOrigin} from '@/lib/pd-admin/http/request';
import {siteConfig} from '@/lib/site';
import {readRequestBytes} from '@/lib/security/request-body';
import {NextRequest,NextResponse} from 'next/server';
import {openEmployeeRegistry} from '@/lib/employee-app/registry';
import {employeeInstallerResponse} from '@/lib/server/employee-app/installer';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 let registry;
 try{
  assertAdministrativeOrigin(request);
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw Error('Denied');
  const body=new TextDecoder().decode(await readRequestBytes(request,256));
  const code=new URLSearchParams(body).get('code')??'';
  registry=openEmployeeRegistry();registry.limit('global',Date.now(),1000);registry.limit('download:'+code.slice(0,64),Date.now(),10);
  if(!registry.canDownload(code))throw Error('Denied');
  return await employeeInstallerResponse();
 }catch{return NextResponse.redirect(new URL('/employee-download?error=access',siteConfig.url),303)}finally{registry?.close()}
}
