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
    fetch_types: false, // per-connection type fetch desyncs behind the pooler
    max: 5,
    // serverless hygiene: fail fast on a wedged connect instead of hanging the
    // render, and never reuse a connection that outlived a frozen lambda
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 300,
  });

globalForDb.__argosSql = sql;
