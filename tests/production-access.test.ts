import assert from 'node:assert/strict';
import test from 'node:test';
import { productionAccessEnvironment } from '../lib/server/production-access/environment';
import { readFile } from 'node:fs/promises';

test('production access opt-in never changes the personal-data rollout environment', () => {
  const original = { NODE_ENV: 'test' as const, PD_ADMIN_ENABLED: 'false', STEEL_PRODUCT_PRODUCTION_APP_ENABLED: 'true' };
  assert.equal(productionAccessEnvironment(original).PD_ADMIN_ENABLED, 'true');
  assert.equal(original.PD_ADMIN_ENABLED, 'false');
  assert.equal(productionAccessEnvironment({NODE_ENV:"test"}).PD_ADMIN_ENABLED, 'false');
  assert.equal(productionAccessEnvironment({ NODE_ENV:"test", STEEL_PRODUCT_PRODUCTION_APP_ENABLED: 'yes' }).PD_ADMIN_ENABLED, 'false');
});

test('production auth retains challenge, session, CSRF and forced password change', async () => {
  const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const login = await read('app/api/internal/production-access/login/route.ts');
  assert.match(login, /verifyPreAuthChallenge/);
  assert.match(login, /environment: productionAccessEnvironment\(\)/);
  assert.match(login, /result.mustChangePassword/);
  const password = await read('app/api/internal/production-access/change-password/route.ts');
  assert.match(password, /assertPdMutationRequest/);
  assert.match(password, /changeAdministrativePassword/);
  const page = await read('lib/server/production-access/page-context.ts');
  assert.match(page, /authenticatePdSession/);
  assert.match(page, /PdPasswordChangeRequiredError/);
});

test('first administrator bootstrap encrypts credentials, requires password change and refuses overwrite', async () => {
  const { generateKeyPairSync, privateDecrypt } = await import('node:crypto');
  const { mkdtemp, writeFile, stat } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { setupProductionAccess } = await import('../scripts/setup-production-access');
  const { DatabaseSync } = await import('node:sqlite');
  const { verifyPassword } = await import('../lib/pd-admin/auth/password');
  const root = await mkdtemp(join(tmpdir(),'production-bootstrap-test-'));
  const {publicKey,privateKey} = generateKeyPairSync('rsa',{modulusLength:3072});
  const publicKeyFile=join(root,'public.pem');const encryptedOutput=join(root,'credentials.enc');const envPath=join(root,'.env.production');
  await writeFile(publicKeyFile,publicKey.export({type:'spki',format:'pem'}));
  await writeFile(envPath,'PD_ADMIN_ENABLED=false\n');
  const environment: NodeJS.ProcessEnv={NODE_ENV:'test',PD_ADMIN_DB_PATH:join(root,'test.sqlite'),PD_EXPORT_PATH:join(root,'exports')};
  await setupProductionAccess({publicKeyFile,encryptedOutput,envPath,environment});
  const text=await readFile(envPath,'utf8');
  assert.match(text,/PD_ADMIN_ENABLED=false/);
  assert.match(text,/STEEL_PRODUCT_PRODUCTION_APP_ENABLED=true/);
  const credentials=JSON.parse(privateDecrypt({key:privateKey,oaepHash:'sha256'},await readFile(encryptedOutput)).toString());
  assert.equal(credentials.username,'production-admin');
  assert.equal(text.includes(credentials.password),false);
  const db=new DatabaseSync(environment.PD_ADMIN_DB_PATH!,{readOnly:true});
  try {const row=db.prepare('SELECT password_hash,must_change_password FROM users WHERE username=?').get(credentials.username) as {password_hash:string;must_change_password:number};assert.equal(row.must_change_password,1);assert.equal(verifyPassword(credentials.password,row.password_hash),true);} finally {db.close();}
  assert.equal((await stat(encryptedOutput)).mode & 0o777,0o600);
  await assert.rejects(setupProductionAccess({publicKeyFile,encryptedOutput:join(root,'second.enc'),envPath,environment}),/already exists/);
});
