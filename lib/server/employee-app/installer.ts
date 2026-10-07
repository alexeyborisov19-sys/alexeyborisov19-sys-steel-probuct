import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {isAbsolute,basename} from 'node:path';
import {Readable} from 'node:stream';
export async function employeeInstallerResponse(){
 const path=process.env.STEEL_EMPLOYEE_UPDATE_FILE,manifest=process.env.STEEL_EMPLOYEE_RELEASE_PATH;
 if(!path||!manifest||!isAbsolute(path)||!isAbsolute(manifest))throw Error('Unavailable');
 const raw=await readFile(manifest,'utf8');if(Buffer.byteLength(raw)>4096)throw Error('Unavailable');
 const release=JSON.parse(raw),info=await stat(path),name=basename(path);
 if(!info.isFile()||info.size!==release.bytes||info.size<1||info.size>1_000_000_000||!/^\d+\.\d+\.\d+$/.test(release.version)||name!==`SteelProdukt-Employee-${release.version}-x64.exe`||!/^[a-f0-9]{64}$/.test(release.sha256))throw Error('Unavailable');
 return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(info.size),'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
}
