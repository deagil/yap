import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Until `supabase gen types` is committed, use a loose schema so PostgREST
 * builders are not inferred as `never` (index signatures are not accepted).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generated types replace this
export type Database = any;

export type TypedSupabaseClient = SupabaseClient<Database>;
