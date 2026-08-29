import 'server-only';
import postgres from 'postgres';

// Server-only Postgres client. Uses DATABASE_URL (pooled Supabase connection);
// the service-role key never reaches the client bundle.
const globalForDb = globalThis as unknown as { __argosSql?: ReturnType<typeof postgres> };
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not configured. Run `vercel env pull .env.local --environment=production` before starting Argos locally.',
  );
}

export const sql =
  globalForDb.__argosSql ??
  postgres(databaseUrl, {
    ssl: 'require',
    prepare: false, // transaction-mode pooler compatibility
    // Overview queries are independent; allow one request to render promptly.
    max: 5,
  });

globalForDb.__argosSql = sql;
