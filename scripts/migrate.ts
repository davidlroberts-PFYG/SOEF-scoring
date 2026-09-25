import './env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPool } from '../src/db/client';

async function main() {
  const db = getDb();
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
