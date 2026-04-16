/**
 * Applies SQL files from `supabase/migrations` in filename order.
 *
 * Neon + Drizzle migrations are retired — use a Supabase project and set
 * `POSTGRES_URL` to the Supabase Postgres connection string (direct or pooler).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "supabase",
  "migrations",
);

const url = process.env.POSTGRES_URL;
if (!url) {
  console.log("POSTGRES_URL not set — skipping migrations");
  process.exit(0);
}

const sql = postgres(url, { max: 1 });

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

try {
  const files = listMigrationFiles();
  if (files.length === 0) {
    console.log("No SQL migrations in supabase/migrations — skipping");
    process.exit(0);
  }

  await sql`
    create table if not exists public._yap_applied_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  console.log("Running database migrations…");
  for (const file of files) {
    const applied = await sql<{ c: number }[]>`
      select count(*)::int as c from public._yap_applied_migrations where filename = ${file}
    `;
    if (applied[0]?.c && applied[0].c > 0) {
      console.log(`  (skip) ${file}`);
      continue;
    }

    const fullPath = join(MIGRATIONS_DIR, file);
    const body = readFileSync(fullPath, "utf8");
    console.log(`  → ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`
        insert into public._yap_applied_migrations (filename) values (${file})
      `;
    });
  }
  console.log("Migrations applied successfully");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await sql.end();
}
