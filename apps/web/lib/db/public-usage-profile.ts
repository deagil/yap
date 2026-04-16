import { cache } from "react";
import type { UsageInsights, UsageRepositoryInsight } from "@/lib/usage/types";
import {
  parsePublicUsageDate,
  type PublicUsageDateSelection,
} from "@/lib/usage/date-range";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getUsageInsightsAllWorkspaces } from "./usage-insights";
import { getUsageHistoryAllWorkspaces, type DailyUsage } from "./usage";

export interface PublicUsageModelSummary {
  modelId: string;
  provider: string;
  label: string;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  messageCount: number;
  toolCallCount: number;
}

export interface PublicUsageTotals {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  messageCount: number;
  toolCallCount: number;
  totalTokens: number;
}

export interface PublicUsageDailyActivity {
  date: string;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  toolCallCount: number;
}

export interface PublicUsageProfile {
  user: {
    id: string;
    username: string;
    name: string | null;
    avatarUrl: string | null;
  };
  dateSelection: PublicUsageDateSelection;
  invalidDateError: string | null;
  totals: PublicUsageTotals;
  agentSplit: {
    mainTokens: number;
    subagentTokens: number;
  };
  topModels: PublicUsageModelSummary[];
  topRepositories: UsageRepositoryInsight[];
  insights: UsageInsights;
  dailyActivity: PublicUsageDailyActivity[];
  hasUsage: boolean;
}

export function displayModelId(modelId: string): string {
  const slashIndex = modelId.indexOf("/");
  return slashIndex >= 0 ? modelId.slice(slashIndex + 1) : modelId;
}

function sumRows(rows: DailyUsage[]): PublicUsageTotals {
  const totals = rows.reduce(
    (acc, row) => {
      acc.inputTokens += row.inputTokens;
      acc.cachedInputTokens += row.cachedInputTokens;
      acc.outputTokens += row.outputTokens;
      acc.messageCount += row.messageCount;
      acc.toolCallCount += row.toolCallCount;
      return acc;
    },
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      messageCount: 0,
      toolCallCount: 0,
      totalTokens: 0,
    },
  );

  totals.totalTokens = totals.inputTokens + totals.outputTokens;
  return totals;
}

function mergeDailyActivity(rows: DailyUsage[]): PublicUsageDailyActivity[] {
  const map = new Map<string, PublicUsageDailyActivity>();
  for (const r of rows) {
    const existing = map.get(r.date);
    if (existing) {
      existing.inputTokens += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      existing.messageCount += r.messageCount;
      existing.toolCallCount += r.toolCallCount;
    } else {
      map.set(r.date, {
        date: r.date,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        messageCount: r.messageCount,
        toolCallCount: r.toolCallCount,
      });
    }
  }
  return [...map.values()];
}

export function buildPublicUsageProfileData(params: {
  usage: DailyUsage[];
  insights: UsageInsights;
}): Pick<
  PublicUsageProfile,
  | "totals"
  | "agentSplit"
  | "topModels"
  | "topRepositories"
  | "dailyActivity"
  | "hasUsage"
> {
  const modelUsage = new Map<string, PublicUsageModelSummary>();
  let mainTokens = 0;
  let subagentTokens = 0;

  for (const row of params.usage) {
    const rowTokens = row.inputTokens + row.outputTokens;

    if (row.agentType === "main") {
      mainTokens += rowTokens;
    } else {
      subagentTokens += rowTokens;
    }

    if (!row.modelId) {
      continue;
    }

    const existing = modelUsage.get(row.modelId);
    if (existing) {
      existing.totalTokens += rowTokens;
      existing.inputTokens += row.inputTokens;
      existing.cachedInputTokens += row.cachedInputTokens;
      existing.outputTokens += row.outputTokens;
      existing.messageCount += row.messageCount;
      existing.toolCallCount += row.toolCallCount;
      continue;
    }

    modelUsage.set(row.modelId, {
      modelId: row.modelId,
      provider: row.provider ?? "unknown",
      label: displayModelId(row.modelId),
      totalTokens: rowTokens,
      inputTokens: row.inputTokens,
      cachedInputTokens: row.cachedInputTokens,
      outputTokens: row.outputTokens,
      messageCount: row.messageCount,
      toolCallCount: row.toolCallCount,
    });
  }

  return {
    totals: sumRows(params.usage),
    agentSplit: {
      mainTokens,
      subagentTokens,
    },
    topModels: [...modelUsage.values()].toSorted((a, b) => {
      if (b.totalTokens !== a.totalTokens) {
        return b.totalTokens - a.totalTokens;
      }

      return a.modelId.localeCompare(b.modelId);
    }),
    topRepositories: params.insights.topRepositories,
    dailyActivity: mergeDailyActivity(params.usage),
    hasUsage: params.usage.length > 0,
  };
}

const ALL_TIME_DATE_SELECTION: PublicUsageDateSelection = {
  kind: "all",
  value: null,
  label: "All time",
  range: null,
};

interface PublicUsageUserCandidate {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  updatedAt: Date | null;
  publicUsageEnabled: boolean | null;
}

function pickPublicUsageUserCandidate(
  candidates: PublicUsageUserCandidate[],
  requestedUsername: string,
): PublicUsageProfile["user"] | null {
  const enabledCandidates = candidates.filter(
    (candidate) => candidate.publicUsageEnabled,
  );

  if (enabledCandidates.length === 0) {
    return null;
  }

  const selectedCandidate = enabledCandidates.toSorted((a, b) => {
    const exactMatchDifference =
      Number(b.username === requestedUsername) -
      Number(a.username === requestedUsername);
    if (exactMatchDifference !== 0) {
      return exactMatchDifference;
    }

    const updatedDifference =
      (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
    if (updatedDifference !== 0) {
      return updatedDifference;
    }

    return a.id.localeCompare(b.id);
  })[0];

  return selectedCandidate
    ? {
        id: selectedCandidate.id,
        username: selectedCandidate.username,
        name: selectedCandidate.name,
        avatarUrl: selectedCandidate.avatarUrl,
      }
    : null;
}

export const getPublicUsageProfile = cache(
  async (
    username: string,
    dateValue: string | null,
  ): Promise<PublicUsageProfile | null> => {
    const normalizedUsername = username.trim().toLowerCase();
    const admin = getSupabaseAdmin();
    const { data: userRows, error: uErr } = await admin
      .from("users")
      .select("id, username, name, avatar_url, updated_at")
      .ilike("username", normalizedUsername);
    if (uErr) {
      throw uErr;
    }

    const candidates: PublicUsageUserCandidate[] = [];
    for (const row of userRows ?? []) {
      const uid = row.id as string;
      const { data: prefs } = await admin
        .from("user_preferences")
        .select("public_usage_enabled")
        .eq("user_id", uid)
        .eq("public_usage_enabled", true)
        .limit(1);
      const enabled = (prefs?.length ?? 0) > 0;
      candidates.push({
        id: uid,
        username: row.username as string,
        name: (row.name as string | null) ?? null,
        avatarUrl: (row.avatar_url as string | null) ?? null,
        updatedAt: row.updated_at ? new Date(row.updated_at as string) : null,
        publicUsageEnabled: enabled,
      });
    }

    const user = pickPublicUsageUserCandidate(candidates, username);

    if (!user) {
      return null;
    }

    const parsedDate = parsePublicUsageDate(dateValue);
    const dateSelection = parsedDate.ok
      ? parsedDate.selection
      : ALL_TIME_DATE_SELECTION;
    const queryOptions = dateSelection.range
      ? { range: dateSelection.range }
      : { allTime: true };

    const [usage, insights] = await Promise.all([
      getUsageHistoryAllWorkspaces(user.id, queryOptions),
      getUsageInsightsAllWorkspaces(user.id, queryOptions),
    ]);
    const derived = buildPublicUsageProfileData({ usage, insights });

    return {
      user,
      dateSelection,
      invalidDateError: parsedDate.ok ? null : parsedDate.error,
      totals: derived.totals,
      agentSplit: derived.agentSplit,
      topModels: derived.topModels,
      topRepositories: derived.topRepositories,
      insights,
      dailyActivity: derived.dailyActivity,
      hasUsage: derived.hasUsage,
    };
  },
);
