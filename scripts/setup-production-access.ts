/** Owner-authorized first production administrator. Never prints plaintext credentials. */
import { randomBytes, randomUUID, publicEncrypt } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, chmodSync, renameSync } from 'node:fs';
import { DatabaseSync, backup } from 'node:sqlite';
import { resolve } from 'node:path';
import {pathToFileURL} from 'node:url';
import { hashAdministrativeFingerprint } from '@/lib/pd-admin/auth/session-store';
import { hashPassword, passwordAlgorithm, passwordVersion } from '@/lib/pd-admin/auth/password';
import { openPdDatabase, closePdDatabase } from '@/lib/pd-admin/db/database';
import { recordAccessEventInTransaction } from '@/lib/pd-admin/audit/chain';
import { productionAccessEnvironment } from '@/lib/server/production-access/environment';
import { readPdAdminConfig } from '@/lib/pd-admin/config';

export async function setupProductionAccess(input: {publicKeyFile:string; encryptedOutput:string; envPath?:string; environment?:NodeJS.ProcessEnv}) {
  const {publicKeyFile, encryptedOutput}=input;
  if (!publicKeyFile || !encryptedOutput) throw new Error('Public key and encrypted output paths required');
  const publicKey = readFileSync(publicKeyFile, 'utf8');
  // Validate the delivery key before touching the environment or database.
  publicEncrypt({key:publicKey,oaepHash:'sha256'}, Buffer.from('production-access-check'));
  const envPath = input.envPath ?? resolve('.env.production');
  let text = readFileSync(envPath,'utf8');
  const environment: NodeJS.ProcessEnv = {...(input.environment ?? process.env),NODE_ENV:input.environment?.NODE_ENV ?? 'production'};
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) environment[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  const setValue = (key:string,value:string) => {
    const expression = new RegExp(`^${key}=.*$`,'m');
    text = expression.test(text) ? text.replace(expression,`${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
    environment[key] = value;
  };
  for (const key of ['PD_SEARCH_HMAC_KEY','PD_SESSION_HASH_KEY','PD_AUDIT_CHAIN_KEY']) {
    if (!environment[key]) setValue(key,randomBytes(32).toString('hex'));
  }
  const scoped = productionAccessEnvironment({...environment,STEEL_PRODUCT_PRODUCTION_APP_ENABLED:'true'});
  const config = readPdAdminConfig(scoped);
  if (existsSync(config.databasePath)) {
    const source = new DatabaseSync(config.databasePath,{readOnly:true});
    try { const target=`${config.databasePath}.before-production-${Date.now()}.bak`; await backup(source,target); chmodSync(target,0o600); }
    finally { source.close(); }
  }
  const db = openPdDatabase({environment:scoped});
  try {
    if (db.prepare("SELECT id FROM users WHERE username = 'production-admin'").get()) throw new Error('Production administrator already exists; no reset performed');
    const password = `Aa1!${randomBytes(24).toString('base64url')}`;
    const credentials = {url:'https://www.steelprodukt.ru/internal/production-access/login',username:'production-admin',password};
    const encrypted = publicEncrypt({key:publicKey,oaepHash:'sha256'},Buffer.from(JSON.stringify(credentials)));
    // Save recoverable encrypted credentials before account creation. No plaintext leaves memory.
    writeFileSync(encryptedOutput,encrypted,{mode:0o600,flag:'wx'});
    const userId=randomUUID();const now=new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("INSERT INTO users(id,username,display_name,password_hash,password_algorithm,password_version,role,is_active,must_change_password,created_at,updated_at) VALUES (?, 'production-admin', 'Production administrator', ?, ?, ?, 'ADMIN', 1, 1, ?, ?)").run(userId,hashPassword(password),passwordAlgorithm,passwordVersion,now,now);
      recordAccessEventInTransaction(db,{occurredAt:now,userId,action:'CREATE_FIRST_ADMIN',targetType:'USER',targetId:userId,legalBasis:'INITIAL_SYSTEM_CONFIGURATION',result:'SUCCESS',ipHash:hashAdministrativeFingerprint('production-bootstrap',config.sessionHashKey!,'ip'),metadata:{role:'ADMIN',code:'MUST_CHANGE_PASSWORD'}},config.auditChainKey!);
      db.exec('COMMIT');
    } catch(error) { db.exec('ROLLBACK'); throw error; }
    setValue('STEEL_PRODUCT_PRODUCTION_APP_ENABLED','true');
    const temporary=`${envPath}.production-access.tmp`;
    writeFileSync(temporary,text,{mode:0o600});chmodSync(temporary,0o600);renameSync(temporary,envPath);
    console.log(JSON.stringify({productionAccessConfigured:true,administratorCreated:true,passwordChangeRequired:true,personalDataFlagUnchanged:true}));
  } finally {closePdDatabase(db,config.databasePath);}
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) setupProductionAccess({publicKeyFile:process.argv[2],encryptedOutput:process.argv[3]}).catch(()=>{console.error('Production access setup did not complete. Existing accounts were not reset; no plaintext secret was logged.');process.exitCode=1;});
