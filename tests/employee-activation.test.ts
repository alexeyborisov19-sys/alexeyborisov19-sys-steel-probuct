import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {EmployeeRegistry} from '../lib/employee-app/registry';
test('employee activation: limits, restart persistence, isolation and irreversible device revocation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'employee-test-')),file=join(dir,'registry.sqlite');let r=new EmployeeRegistry(file);
 try {const {code,id}=r.create('Сотрудник 1',1,'owner'),device=randomUUID(),other=randomUUID();const first=r.activate(code,device);
 assert.equal(r.check(first.token,device),true);assert.equal(r.check(first.token,other),false);
 assert.throws(()=>r.activate(code,other),/DEVICE_LIMIT/);
 r.close();r=new EmployeeRegistry(file);assert.equal(r.check(first.token,device),true);
 const again=r.activate(code,device);assert.equal(r.check(first.token,device),false);assert.equal(r.check(again.token,device),true);
 r.revoke('device',again.device,'owner');assert.equal(r.check(again.token,device),false);assert.throws(()=>r.activate(code,device),/ACTIVATION_DENIED/);
 const replacement=r.activate(code,other);r.revoke('license',id,'owner');assert.equal(r.check(replacement.token,other),false);
 assert.equal(readFileSync(file).includes(Buffer.from(code)),false);assert.equal(readFileSync(file).includes(Buffer.from(replacement.token)),false);
 assert.ok(!JSON.stringify(r.list()).includes('token_hash'));
 }finally{r.close();rmSync(dir,{recursive:true,force:true})}
});
test('input bounds and request throttling',()=>{const dir=mkdtempSync(join(tmpdir(),'employee-test-'));const r=new EmployeeRegistry(join(dir,'db'));try{assert.throws(()=>r.create('x',0,'owner'));assert.throws(()=>r.create('',1,'owner'));for(let i=0;i<20;i++)r.limit('a',100);assert.throws(()=>r.limit('a',100),/RATE_LIMIT/);r.limit('b',100);r.limit('a',60101)}finally{r.close();rmSync(dir,{recursive:true,force:true})}});
