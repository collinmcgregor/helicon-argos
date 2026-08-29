import 'server-only';
import postgres from 'postgres';

// Server-only Postgres client. Uses DATABASE_URL (pooled Supabase connection);
// the service-role key never reaches the client bundle.
const globalForDb = globalThis as unknown as { __argosSql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.__argosSql ??
  postgres(process.env.DATABASE_URL ?? '', {
    ssl: 'require',
    prepare: false, // transaction-mode pooler compatibility
    max: 5,
  });

globalForDb.__argosSql = sql;
