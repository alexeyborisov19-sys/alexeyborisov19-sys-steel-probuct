import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {isAbsolute,basename} from 'node:path';
import {Readable} from 'node:stream';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{fileName:string}>}){
 try{
  if(process.env.STEEL_EMPLOYEE_ACTIVATION_ENABLED!=='true')return new Response(null,{status:404});
  const {fileName}=await params,path=process.env.STEEL_EMPLOYEE_INSTALLER_PATH,manifest=process.env.STEEL_EMPLOYEE_RELEASE_PATH;
  if(!/^SteelProdukt-Employee-\d+\.\d+\.\d+-x64\.exe$/.test(fileName)||!path||!manifest||!isAbsolute(path)||!isAbsolute(manifest)||basename(path)!==fileName)return new Response(null,{status:404});
  const release=JSON.parse(await readFile(manifest,'utf8')),info=await stat(path);
  if(!info.isFile()||info.size!==release.bytes||release.url!==`https://www.steelprodukt.ru/downloads/employee/${fileName}`)return new Response(null,{status:503});
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(info.size),'Content-Disposition':`attachment; filename="${fileName}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
 }catch{return new Response(null,{status:503})}
}
