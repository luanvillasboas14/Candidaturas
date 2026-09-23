import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { readEnv } from './env';

let pool: Pool | null = null;

export function getDnaWorkPool(): Pool {
  if (pool) return pool;

  const host = readEnv('DNA_WORK_DB_HOST');
  const user = readEnv('DNA_WORK_DB_USER');
  const password = readEnv('DNA_WORK_DB_PASS');
  const database = readEnv('DNA_WORK_DB_NAME') || 'dna_work';
  const port = Number(readEnv('DNA_WORK_DB_PORT') || '3306');

  if (!host || !user || !password) {
    throw new Error('DNA_WORK_DB_HOST, DNA_WORK_DB_USER e DNA_WORK_DB_PASS precisam estar configuradas.');
  }

  pool = mysql.createPool({
    host,
    port: Number.isFinite(port) ? port : 3306,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 8,
    charset: 'utf8mb4',
    ssl: { rejectUnauthorized: false },
  });

  return pool;
}

export async function withDnaWorkTransaction<T>(
  work: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getDnaWorkPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export type DnaRow = RowDataPacket;
