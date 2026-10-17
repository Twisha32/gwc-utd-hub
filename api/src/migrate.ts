import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db';

const LOCK_ID = 727274;

export async function migrate(log: (msg: string) => void = console.log) {
  const dir = path.join(__dirname, '..', 'migrations');
  const client = await pool.connect();
  try {
    // two instances booting together shouldn't both try to migrate
    await client.query('select pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )`);

    const { rows } = await client.query<{ name: string }>('select name from schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
        log(`applied ${file}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}
