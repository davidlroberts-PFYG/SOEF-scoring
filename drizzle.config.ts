import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/value_gap',
  },
  strict: true,
  verbose: true,
});
