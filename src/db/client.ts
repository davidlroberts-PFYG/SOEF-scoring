import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

declare global {
  var __valueGapPool: Pool | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }
  return url;
}

/**
 * One pool per process. In dev, Next re-evaluates modules on hot reload, so
 * the pool is stashed on globalThis to avoid leaking connections. Neon and
 * Vercel Postgres both accept a standard Postgres connection string; on
 * Vercel use the *pooled* connection string.
 */
export function getPool(): Pool {
  if (!globalThis.__valueGapPool) {
    const url = connectionString();
    const needsSsl = !/localhost|127\.0\.0\.1/.test(url);
    globalThis.__valueGapPool = new Pool({
      connectionString: url,
      max: 5,
      ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
    });
  }
  return globalThis.__valueGapPool;
}

let cached: Db | undefined;

export function getDb(): Db {
  if (!cached) cached = drizzle(getPool(), { schema });
  return cached;
}

export { schema };
