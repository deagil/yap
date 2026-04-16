import { isToolUIPart, type LanguageModel, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageDateRange } from "@/lib/usage/date-range";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type UsageSource = "web";
export type UsageAgentType = "main" | "subagent";

async function db(client?: SupabaseClient) {
  return client ?? (await createServerSupabase());
}

/** Aggregates usage across all workspaces for a user (service role; public leaderboard). */
export async function getUsageHistoryAllWorkspaces(
  userId: string,
  options?: UsageHistoryOptions,
): Promise<DailyUsage[]> {
  const supabase = getSupabaseAdmin();

  let q = supabase
    .from("usage_events")
    .select(
      "created_at, source, agent_type, provider, model_id, input_tokens, cached_input_tokens, output_tokens, tool_call_count",
    )
    .eq("user_id", userId);

  if (options?.range) {
    q = q
      .gte("created_at", `${options.range.from}T00:00:00.000Z`)
      .lte("created_at", `${options.range.to}T23:59:59.999Z`);
  } else if (!options?.allTime) {
    const days = options?.days ?? 280;
    const since = new Date();
    since.setDate(since.getDate() - days);
    q = q.gte("created_at", since.toISOString());
  }

  const { data: rows, error } = await q.order("created_at", {
    ascending: true,
  });
  if (error) {
    throw error;
  }

  const buckets = new Map<
    string,
    {
      date: string;
      source: UsageSource;
      agentType: UsageAgentType;
      provider: string | null;
      modelId: string | null;
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      messageCount: number;
      toolCallCount: number;
    }
  >();

  for (const r of rows ?? []) {
    const d = new Date(r.created_at as string);
    const dateKey = d.toISOString().slice(0, 10);
    const source = r.source as UsageSource;
    const agentType = r.agent_type as UsageAgentType;
    const provider = (r.provider as string | null) ?? null;
    const modelId = (r.model_id as string | null) ?? null;
    const composite = `${dateKey}|${source}|${agentType}|${provider ?? ""}|${modelId ?? ""}`;
    const existing = buckets.get(composite);
    const inputTokens = Number(r.input_tokens ?? 0);
    const cachedInputTokens = Number(r.cached_input_tokens ?? 0);
    const outputTokens = Number(r.output_tokens ?? 0);
    const toolCallCount = Number(r.tool_call_count ?? 0);
    const messageInc = agentType === "main" ? 1 : 0;

    if (existing) {
      existing.inputTokens += inputTokens;
      existing.cachedInputTokens += cachedInputTokens;
      existing.outputTokens += outputTokens;
      existing.toolCallCount += toolCallCount;
      existing.messageCount += messageInc;
    } else {
      buckets.set(composite, {
        date: dateKey,
        source,
        agentType,
        provider,
        modelId,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        messageCount: messageInc,
        toolCallCount,
      });
    }
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function recordUsage(
  userId: string,
  workspaceId: string,
  data: {
    source: UsageSource;
    agentType?: UsageAgentType;
    model: LanguageModel | string;
    messages: UIMessage[];
    usage: {
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
    };
    toolCallCount?: number;
  },
  client?: SupabaseClient,
) {
  const supabase = await db(client);

  const inferredToolCallCount = data.messages
    .flatMap((m) => m.parts)
    .filter(isToolUIPart).length;
  const toolCallCount = data.toolCallCount ?? inferredToolCallCount;

  const provider =
    typeof data.model === "string"
      ? data.model.split("/")[0]
      : data.model.provider;
  const modelId =
    typeof data.model === "string" ? data.model : data.model.modelId;

  const { error } = await supabase.from("usage_events").insert({
    id: nanoid(),
    workspace_id: workspaceId,
    user_id: userId,
    source: data.source,
    agent_type: data.agentType ?? "main",
    provider: provider ?? null,
    model_id: modelId ?? null,
    input_tokens: data.usage.inputTokens,
    cached_input_tokens: data.usage.cachedInputTokens,
    output_tokens: data.usage.outputTokens,
    tool_call_count: toolCallCount,
  });
  if (error) {
    throw error;
  }
}

export interface DailyUsage {
  date: string;
  source: UsageSource;
  agentType: UsageAgentType;
  provider: string | null;
  modelId: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  messageCount: number;
  toolCallCount: number;
}

export interface UsageHistoryOptions {
  days?: number;
  range?: UsageDateRange;
  allTime?: boolean;
}

export async function getUsageHistory(
  userId: string,
  workspaceId: string,
  options?: UsageHistoryOptions,
  client?: SupabaseClient,
): Promise<DailyUsage[]> {
  const supabase = await db(client);

  let q = supabase
    .from("usage_events")
    .select(
      "created_at, source, agent_type, provider, model_id, input_tokens, cached_input_tokens, output_tokens, tool_call_count",
    )
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);

  if (options?.range) {
    q = q
      .gte("created_at", `${options.range.from}T00:00:00.000Z`)
      .lte("created_at", `${options.range.to}T23:59:59.999Z`);
  } else if (!options?.allTime) {
    const days = options?.days ?? 280;
    const since = new Date();
    since.setDate(since.getDate() - days);
    q = q.gte("created_at", since.toISOString());
  }

  const { data: rows, error } = await q.order("created_at", {
    ascending: true,
  });
  if (error) {
    throw error;
  }

  const buckets = new Map<
    string,
    {
      date: string;
      source: UsageSource;
      agentType: UsageAgentType;
      provider: string | null;
      modelId: string | null;
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      messageCount: number;
      toolCallCount: number;
    }
  >();

  for (const r of rows ?? []) {
    const d = new Date(r.created_at as string);
    const dateKey = d.toISOString().slice(0, 10);
    const source = r.source as UsageSource;
    const agentType = r.agent_type as UsageAgentType;
    const provider = (r.provider as string | null) ?? null;
    const modelId = (r.model_id as string | null) ?? null;
    const composite = `${dateKey}|${source}|${agentType}|${provider ?? ""}|${modelId ?? ""}`;
    const existing = buckets.get(composite);
    const inputTokens = Number(r.input_tokens ?? 0);
    const cachedInputTokens = Number(r.cached_input_tokens ?? 0);
    const outputTokens = Number(r.output_tokens ?? 0);
    const toolCallCount = Number(r.tool_call_count ?? 0);
    const messageInc = agentType === "main" ? 1 : 0;

    if (existing) {
      existing.inputTokens += inputTokens;
      existing.cachedInputTokens += cachedInputTokens;
      existing.outputTokens += outputTokens;
      existing.toolCallCount += toolCallCount;
      existing.messageCount += messageInc;
    } else {
      buckets.set(composite, {
        date: dateKey,
        source,
        agentType,
        provider,
        modelId,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        messageCount: messageInc,
        toolCallCount,
      });
    }
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}
