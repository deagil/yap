import type { UsageDateRange } from "@/lib/usage/date-range";
import { getUsageLeaderboardDomain } from "@/lib/usage/leaderboard-domain";
import type {
  UsageDomainLeaderboard,
  UsageDomainLeaderboardRow,
} from "@/lib/usage/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export { getUsageLeaderboardDomain };

interface UsageDomainLeaderboardQueryRow {
  userId: string;
  email: string | null;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  modelId: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface UsageDomainLeaderboardOptions {
  days?: number;
  range?: UsageDateRange;
}

function inRange(
  createdAt: string,
  options?: UsageDomainLeaderboardOptions,
): boolean {
  const d = new Date(createdAt);
  if (options?.range) {
    const from = new Date(`${options.range.from}T00:00:00.000Z`);
    const to = new Date(`${options.range.to}T23:59:59.999Z`);
    return d >= from && d <= to;
  }
  const days = options?.days ?? 280;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return d >= since;
}

function shouldReplaceMostUsedModel(params: {
  currentModelId: string | null;
  currentTokens: number;
  candidateModelId: string | null;
  candidateTokens: number;
}): boolean {
  const { currentModelId, currentTokens, candidateModelId, candidateTokens } =
    params;

  if (candidateTokens > currentTokens) {
    return true;
  }

  if (candidateTokens < currentTokens) {
    return false;
  }

  if (currentModelId === null && candidateModelId !== null) {
    return true;
  }

  if (currentModelId !== null && candidateModelId === null) {
    return false;
  }

  if (currentModelId === null || candidateModelId === null) {
    return false;
  }

  return candidateModelId < currentModelId;
}

export function buildUsageDomainLeaderboardRows(
  rows: UsageDomainLeaderboardQueryRow[],
): UsageDomainLeaderboardRow[] {
  const leaderboard = new Map<string, UsageDomainLeaderboardRow>();

  for (const row of rows) {
    if (!row.email) {
      continue;
    }

    const modelTokens = row.totalInputTokens + row.totalOutputTokens;
    const existing = leaderboard.get(row.userId);

    if (existing) {
      existing.totalTokens += modelTokens;
      if (
        shouldReplaceMostUsedModel({
          currentModelId: existing.mostUsedModelId,
          currentTokens: existing.mostUsedModelTokens,
          candidateModelId: row.modelId,
          candidateTokens: modelTokens,
        })
      ) {
        existing.mostUsedModelId = row.modelId;
        existing.mostUsedModelTokens = modelTokens;
      }
      continue;
    }

    leaderboard.set(row.userId, {
      userId: row.userId,
      username: row.username,
      name: row.name,
      avatarUrl: row.avatarUrl,
      totalTokens: modelTokens,
      mostUsedModelId: row.modelId,
      mostUsedModelTokens: modelTokens,
    });
  }

  return [...leaderboard.values()]
    .filter((row) => row.totalTokens > 0)
    .toSorted((a, b) => {
      if (b.totalTokens !== a.totalTokens) {
        return b.totalTokens - a.totalTokens;
      }

      const usernameOrder = a.username.localeCompare(b.username);
      if (usernameOrder !== 0) {
        return usernameOrder;
      }

      return a.userId.localeCompare(b.userId);
    });
}

export async function getUsageDomainLeaderboard(
  email: string | null | undefined,
  options?: UsageDomainLeaderboardOptions,
): Promise<UsageDomainLeaderboard | null> {
  const domain = getUsageLeaderboardDomain(email);
  if (!domain) {
    return null;
  }

  const admin = getSupabaseAdmin();
  const { data: events, error: eErr } = await admin
    .from("usage_events")
    .select("user_id, model_id, input_tokens, output_tokens, created_at");
  if (eErr) {
    throw eErr;
  }

  const filtered = (events ?? []).filter((ev) =>
    inRange(ev.created_at as string, options),
  );

  const userIds = [...new Set(filtered.map((e) => e.user_id as string))];
  if (userIds.length === 0) {
    return { domain, rows: [] };
  }

  const { data: users, error: uErr } = await admin
    .from("users")
    .select("id, email, username, name, avatar_url")
    .in("id", userIds);
  if (uErr) {
    throw uErr;
  }

  const userMap = new Map(
    (users ?? []).map((u) => [
      u.id as string,
      u as {
        id: string;
        email: string | null;
        username: string;
        name: string | null;
        avatar_url: string | null;
      },
    ]),
  );

  const rows: UsageDomainLeaderboardQueryRow[] = [];
  for (const ev of filtered) {
    const uid = ev.user_id as string;
    const u = userMap.get(uid);
    if (!u?.email) {
      continue;
    }
    const emailDomain = u.email.split("@")[1]?.toLowerCase();
    if (emailDomain !== domain) {
      continue;
    }
    rows.push({
      userId: uid,
      email: u.email,
      username: u.username,
      name: u.name,
      avatarUrl: u.avatar_url,
      modelId: (ev.model_id as string | null) ?? null,
      totalInputTokens: Number(ev.input_tokens ?? 0),
      totalOutputTokens: Number(ev.output_tokens ?? 0),
    });
  }

  return {
    domain,
    rows: buildUsageDomainLeaderboardRows(rows),
  };
}
