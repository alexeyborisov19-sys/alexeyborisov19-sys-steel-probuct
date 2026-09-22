import assert from 'node:assert/strict';import test from 'node:test';
import {inspectUploads,cadUploadLimits,uploadLimits} from '../lib/security/uploads';
test('CAD accepts a complete STEP above former middleware 10 MiB limit; lead limits unchanged',async()=>{
 const body='ISO-10303-21;\nHEADER;\nENDSEC;\n/*'+'x'.repeat(11*1024*1024)+'*/\nDATA;\nENDSEC;\nEND-ISO-10303-21;';
 const file=new File([body],'large.step',{type:'application/octet-stream'});
 const [result]=await inspectUploads([file],1,cadUploadLimits);assert.equal(result.buffer.byteLength,Buffer.byteLength(body));
 await assert.rejects(()=>inspectUploads([file]),/7 МБ/);assert.equal(uploadLimits.maximumMultipartBytes,11*1024*1024);
});
test('oversized CAD is rejected before reading contents',async()=>{
 let read=false;const file={name:'large.step',size:cadUploadLimits.maximumFileBytes+1,arrayBuffer:async()=>{read=true;return new ArrayBuffer(0);}} as File;
 await assert.rejects(()=>inspectUploads([file],1,cadUploadLimits),/50 МБ/);assert.equal(read,false);
});
