/**
 * Verifies that Supabase SQL migrations exist (Drizzle drift check removed).
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "supabase", "migrations");
const sqlFiles = readdirSync(dir).filter((f) => f.endsWith(".sql"));

if (sqlFiles.length === 0) {
  console.error("❌ No .sql files in supabase/migrations");
  process.exit(1);
}

console.log(`✓ Found ${sqlFiles.length} Supabase migration(s)`);
