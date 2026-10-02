import {NextRequest} from 'next/server';
import {requirePdApiContext,pdRouteError} from '@/lib/pd-admin/http/route-context';
import {assertPdMutationRequest} from '@/lib/pd-admin/auth/csrf';
import {assertJsonMutation} from '@/lib/pd-admin/http/request';
import {isStepUpActive} from '@/lib/pd-admin/auth/session';
import {readPdJsonBody} from '@/lib/pd-admin/http/body';
import {pdSafeJson,pdSafeError} from '@/lib/pd-admin/http/safe-response';
import {ActivationError,openEmployeeRegistry} from '@/lib/employee-app/registry';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:NextRequest){let context,registry;try{context=requirePdApiContext(request,'MANAGE_USERS');registry=openEmployeeRegistry();return pdSafeJson({ok:true,...registry.list()})}catch(e){return e instanceof ActivationError?pdSafeError('UNAVAILABLE',503):pdRouteError(e)}finally{registry?.close();context?.close()}}
export async function POST(request:NextRequest){let context,registry;try{
 assertJsonMutation(request);context=requirePdApiContext(request,'MANAGE_USERS');
 assertPdMutationRequest(request,context.session.csrfSecretHash,context.config.sessionHashKey!);
 if(!isStepUpActive(context.session.stepUpUntil))return pdSafeError('STEP_UP_REQUIRED',403);
 const body=await readPdJsonBody<{action?:unknown;label?:unknown;limit?:unknown;id?:unknown;kind?:unknown}>(request,4096);
 registry=openEmployeeRegistry();
 if(body.action==='create'&&typeof body.label==='string'&&typeof body.limit==='number')return pdSafeJson({ok:true,...registry.create(body.label,body.limit,context.user.id)});
 if(body.action==='revoke'&&typeof body.id==='string'&&(body.kind==='device'||body.kind==='license')){registry.revoke(body.kind,body.id,context.user.id);return pdSafeJson({ok:true})}
 return pdSafeError('INVALID_INPUT',400);
 }catch(e){return e instanceof ActivationError?pdSafeError(e.message,e.message==='UNAVAILABLE'?503:400):pdRouteError(e)}finally{registry?.close();context?.close()}}
