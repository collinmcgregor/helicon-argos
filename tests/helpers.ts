import { config } from 'dotenv';
import postgres from 'postgres';

// Tests run outside the Next.js server context, so they get their own client
// (lib/db.ts is `server-only`) and load .env.local themselves — explicitly,
// because @next/env skips .env.local under NODE_ENV=test.
config({ path: '.env.local' });

export const sql = postgres(process.env.DATABASE_URL ?? '', {
  ssl: 'require',
  prepare: false,
  max: 3,
});

export { NOW, NOW_ISO, EVENT_HORIZON_LABEL } from '../lib/constants';
