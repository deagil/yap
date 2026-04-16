import {
  buildUsageInsights,
  type UsageAggregateRow,
  type UsageSessionInsightRow,
} from "@/lib/usage/compute-insights";
import {
  getDateRangeDaysInclusive,
  type UsageDateRange,
} from "@/lib/usage/date-range";
import type { UsageInsights } from "@/lib/usage/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const EMPTY_USAGE_AGGREGATE: UsageAggregateRow = {
  totalInputTokens: 0,
  totalCachedInputTokens: 0,
  totalOutputTokens: 0,
  totalToolCallCount: 0,
  mainInputTokens: 0,
  mainOutputTokens: 0,
  mainAssistantTurnCount: 0,
  largestMainTurnTokens: 0,
};

export interface UsageInsightsOptions {
  days?: number;
  range?: UsageDateRange;
  allTime?: boolean;
}

function getLookbackDays(options?: UsageInsightsOptions): number {
  if (options?.range) {
    return getDateRangeDaysInclusive(options.range);
  }

  if (options?.allTime) {
    return 0;
  }

  return options?.days ?? 280;
}

function inDateRange(
  createdAt: string,
  options?: UsageInsightsOptions,
): boolean {
  const d = new Date(createdAt);
  if (options?.range) {
    const from = new Date(`${options.range.from}T00:00:00.000Z`);
    const to = new Date(`${options.range.to}T23:59:59.999Z`);
    return d >= from && d <= to;
  }
  if (options?.allTime) {
    return true;
  }
  const days = options?.days ?? 280;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return d >= since;
}

async function resolveClient(client?: SupabaseClient) {
  return client ?? (await createServerSupabase());
}

export async function getUsageInsights(
  userId: string,
  workspaceId: string,
  options?: UsageInsightsOptions,
  client?: SupabaseClient,
): Promise<UsageInsights> {
  const supabase = await resolveClient(client);

  const { data: usageRows, error: uErr } = await supabase
    .from("usage_events")
    .select(
      "input_tokens, cached_input_tokens, output_tokens, tool_call_count, agent_type, created_at",
    )
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (uErr) {
    throw uErr;
  }

  const filteredUsage = (usageRows ?? []).filter((r) =>
    inDateRange(r.created_at as string, options),
  );

  let aggregate: UsageAggregateRow = { ...EMPTY_USAGE_AGGREGATE };
  for (const r of filteredUsage) {
    const input = Number(r.input_tokens ?? 0);
    const cached = Number(r.cached_input_tokens ?? 0);
    const output = Number(r.output_tokens ?? 0);
    const tools = Number(r.tool_call_count ?? 0);
    const agentType = r.agent_type as string;
    aggregate.totalInputTokens += input;
    aggregate.totalCachedInputTokens += cached;
    aggregate.totalOutputTokens += output;
    aggregate.totalToolCallCount += tools;
    if (agentType === "main") {
      aggregate.mainInputTokens += input;
      aggregate.mainOutputTokens += output;
      aggregate.mainAssistantTurnCount += 1;
      const turn = input + output;
      aggregate.largestMainTurnTokens = Math.max(
        aggregate.largestMainTurnTokens,
        turn,
      );
    }
  }

  const { data: sessionRowsRaw, error: sErr } = await supabase
    .from("sessions")
    .select(
      "repo_owner, repo_name, pr_number, pr_status, lines_added, lines_removed, updated_at",
    )
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (sErr) {
    throw sErr;
  }

  const sessionRows = (sessionRowsRaw ?? []).filter((r) =>
    inDateRange(r.updated_at as string, options),
  ) as unknown as UsageSessionInsightRow[];

  return buildUsageInsights({
    lookbackDays: getLookbackDays(options),
    aggregate,
    sessions: sessionRows,
  });
}

/** Cross-workspace insights for public profile (service role). */
export async function getUsageInsightsAllWorkspaces(
  userId: string,
  options?: UsageInsightsOptions,
): Promise<UsageInsights> {
  const supabase = getSupabaseAdmin();

  const { data: usageRows, error: uErr } = await supabase
    .from("usage_events")
    .select(
      "input_tokens, cached_input_tokens, output_tokens, tool_call_count, agent_type, created_at",
    )
    .eq("user_id", userId);
  if (uErr) {
    throw uErr;
  }

  const filteredUsage = (usageRows ?? []).filter((r) =>
    inDateRange(r.created_at as string, options),
  );

  let aggregate: UsageAggregateRow = { ...EMPTY_USAGE_AGGREGATE };
  for (const r of filteredUsage) {
    const input = Number(r.input_tokens ?? 0);
    const cached = Number(r.cached_input_tokens ?? 0);
    const output = Number(r.output_tokens ?? 0);
    const tools = Number(r.tool_call_count ?? 0);
    const agentType = r.agent_type as string;
    aggregate.totalInputTokens += input;
    aggregate.totalCachedInputTokens += cached;
    aggregate.totalOutputTokens += output;
    aggregate.totalToolCallCount += tools;
    if (agentType === "main") {
      aggregate.mainInputTokens += input;
      aggregate.mainOutputTokens += output;
      aggregate.mainAssistantTurnCount += 1;
      const turn = input + output;
      aggregate.largestMainTurnTokens = Math.max(
        aggregate.largestMainTurnTokens,
        turn,
      );
    }
  }

  const { data: sessionRowsRaw, error: sErr } = await supabase
    .from("sessions")
    .select(
      "repo_owner, repo_name, pr_number, pr_status, lines_added, lines_removed, updated_at",
    )
    .eq("user_id", userId);
  if (sErr) {
    throw sErr;
  }

  const sessionRows = (sessionRowsRaw ?? []).filter((r) =>
    inDateRange(r.updated_at as string, options),
  ) as unknown as UsageSessionInsightRow[];

  return buildUsageInsights({
    lookbackDays: getLookbackDays(options),
    aggregate,
    sessions: sessionRows,
  });
}
