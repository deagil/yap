import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionById, getShareById } from "./sessions";

export const getSessionByIdCached = cache(async (sessionId: string) =>
  getSessionById(sessionId),
);

/** Public share links: use service role so unauthenticated viewers can load the share. */
export const getShareByIdCached = cache(async (shareId: string) =>
  getShareById(shareId, getSupabaseAdmin()),
);
