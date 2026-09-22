import { Pool } from 'pg';
import { readEnv } from './env';

let pool: Pool | null = null;

export function getCruzeiroPool(): Pool {
  if (pool) return pool;

  const host = readEnv('DB_HOST');
  const user = readEnv('DB_USER');
  const password = readEnv('DB_PASS');
  const database = readEnv('DB_NAME');
  const port = Number(readEnv('DB_PORT') || '5432');

  if (!host || !user || !password || !database) {
    throw new Error('DB_HOST, DB_PORT, DB_USER, DB_PASS e DB_NAME precisam estar configuradas.');
  }

  pool = new Pool({
    host,
    port: Number.isFinite(port) ? port : 5432,
    user,
    password,
    database,
    max: 5,
    connectionTimeoutMillis: 10_000,
  });

  return pool;
}
