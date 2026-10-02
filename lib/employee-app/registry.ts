import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export class ActivationError extends Error {}
export class EmployeeRegistry {
  private db: DatabaseSync;
  constructor(file: string) {
    if (!isAbsolute(file)) throw Error('Absolute registry path required');
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file); chmodSync(file, 0o600);
    this.db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS licenses(id TEXT PRIMARY KEY,label TEXT NOT NULL,code_hash TEXT UNIQUE NOT NULL,device_limit INTEGER NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,license_id TEXT NOT NULL,device_hash TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,last_seen TEXT NOT NULL,UNIQUE(license_id,device_hash));
      CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,at TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`);
  }
  close() { this.db.close(); }
  private event(actor: string, action: string, target: string) {
    this.db.prepare('INSERT INTO events(at,actor,action,target) VALUES(?,?,?,?)').run(new Date().toISOString(), actor, action, target);
  }
  create(label: string, limit: number, actor: string) {
    if (!label.trim() || label.length > 80 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new ActivationError('INVALID_INPUT');
    const id = randomUUID(), code = randomBytes(24).toString('base64url');
    this.db.prepare('INSERT INTO licenses(id,label,code_hash,device_limit,created_at) VALUES(?,?,?,?,?)').run(id, label.trim(), hash(code), limit, new Date().toISOString());
    this.event(actor, 'CREATE', id);
    return { id, code };
  }
  limit(key: string, now = Date.now(), maximum = 20) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM attempts WHERE expires < ?').run(now);
      this.db.prepare('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(hash(key), now + 60000);
      const row = this.db.prepare('SELECT count FROM attempts WHERE key=?').get(hash(key)) as {count:number};
      this.db.exec('COMMIT');
      if (row.count > maximum) throw new ActivationError('RATE_LIMIT');
    } catch(e) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw e; }
  }
  activate(code: string, deviceId: string) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(code) || !/^[a-f0-9-]{36}$/.test(deviceId)) throw new ActivationError('ACTIVATION_DENIED');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const l = this.db.prepare('SELECT * FROM licenses WHERE code_hash=?').get(hash(code)) as {id:string;disabled:number;device_limit:number}|undefined;
      if (!l || l.disabled) throw new ActivationError('ACTIVATION_DENIED');
      const old = this.db.prepare('SELECT id,disabled FROM devices WHERE license_id=? AND device_hash=?').get(l.id,hash(deviceId)) as {id:string;disabled:number}|undefined;
      // Revoked computers cannot regain access by re-entering the original code.
      if (old?.disabled) throw new ActivationError('ACTIVATION_DENIED');
      const count = this.db.prepare('SELECT count(*) AS n FROM devices WHERE license_id=? AND disabled=0').get(l.id) as {n:number};
      if (!old && count.n >= l.device_limit) throw new ActivationError('DEVICE_LIMIT');
      const id = old?.id ?? randomUUID(), token = randomBytes(32).toString('base64url'), now = new Date().toISOString();
      if (old) this.db.prepare('UPDATE devices SET token_hash=?,last_seen=? WHERE id=?').run(hash(token),now,id);
      else this.db.prepare('INSERT INTO devices(id,license_id,device_hash,token_hash,created_at,last_seen) VALUES(?,?,?,?,?,?)').run(id,l.id,hash(deviceId),hash(token),now,now);
      this.event('device','ACTIVATE',id); this.db.exec('COMMIT'); return {token,device:id};
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  check(token: string, deviceId: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
    const row = this.db.prepare('SELECT d.id FROM devices d JOIN licenses l ON l.id=d.license_id WHERE d.token_hash=? AND d.device_hash=? AND d.disabled=0 AND l.disabled=0').get(hash(token),hash(deviceId)) as {id:string}|undefined;
    if (!row) return false;
    this.db.prepare('UPDATE devices SET last_seen=? WHERE id=?').run(new Date().toISOString(),row.id); return true;
  }
  revoke(kind: 'device'|'license', id: string, actor: string) {
    const table = kind === 'device' ? 'devices' : 'licenses';
    const result = this.db.prepare(`UPDATE ${table} SET disabled=1 WHERE id=?`).run(id);
    if (Number(result.changes) !== 1) throw new ActivationError('NOT_FOUND');
    this.event(actor,'REVOKE_'+kind.toUpperCase(),id);
  }
  list() {
    return {licenses:this.db.prepare('SELECT id,label,device_limit,disabled,created_at FROM licenses ORDER BY created_at DESC').all(),devices:this.db.prepare('SELECT id,license_id,disabled,created_at,last_seen FROM devices ORDER BY created_at DESC').all()};
  }
}
export function openEmployeeRegistry() {
  if (process.env.STEEL_EMPLOYEE_ACTIVATION_ENABLED !== 'true' || !process.env.STEEL_EMPLOYEE_REGISTRY_PATH) throw new ActivationError('UNAVAILABLE');
  return new EmployeeRegistry(process.env.STEEL_EMPLOYEE_REGISTRY_PATH);
}
