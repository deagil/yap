import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let _admin: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Service-role client (bypasses RLS). Use only in workflows, webhooks, and
 * auth callbacks after validating identity server-side.
 */
export function getSupabaseAdmin() {
  if (_admin) {
    return _admin;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin access",
    );
  }

  _admin = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _admin;
}
