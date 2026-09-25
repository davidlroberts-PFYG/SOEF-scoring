import './env';
import { getDb, getPool } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';

async function main() {
  await seedDatabase(getDb(), (m) => console.log(`  ${m}`));
  console.log('Seed complete.');
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
