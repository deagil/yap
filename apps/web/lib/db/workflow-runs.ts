import type { SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionById } from "./sessions";

export type WorkflowRunStatus = "completed" | "aborted" | "failed";

export type WorkflowRunStepTiming = {
  stepNumber: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  finishReason?: string;
  rawFinishReason?: string;
};

async function resolveClient(client?: SupabaseClient) {
  return client ?? (await createServerSupabase());
}

export async function recordWorkflowRun(
  data: {
    id: string;
    chatId: string;
    sessionId: string;
    userId: string;
    modelId?: string;
    status: WorkflowRunStatus;
    startedAt: string;
    finishedAt: string;
    totalDurationMs: number;
    stepTimings: WorkflowRunStepTiming[];
    slackChannelId?: string | null;
  },
  client?: SupabaseClient,
) {
  const session = await getSessionById(data.sessionId, getSupabaseAdmin());
  if (!session) {
    throw new Error("Session not found for workflow run");
  }
  const workspaceId = session.workspaceId;

  const supabase = await resolveClient(client);

  const runRow = {
    id: data.id,
    workspace_id: workspaceId,
    chat_id: data.chatId,
    session_id: data.sessionId,
    user_id: data.userId,
    model_id: data.modelId ?? null,
    status: data.status,
    started_at: data.startedAt,
    finished_at: data.finishedAt,
    total_duration_ms: data.totalDurationMs,
    slack_channel_id: data.slackChannelId ?? null,
    created_at: new Date().toISOString(),
  };

  const { error: runErr } = await supabase.from("workflow_runs").insert(runRow);
  if (runErr && runErr.code !== "23505") {
    throw runErr;
  }

  if (data.stepTimings.length === 0) {
    return;
  }

  for (const stepTiming of data.stepTimings) {
    const row = {
      id: nanoid(),
      workspace_id: workspaceId,
      workflow_run_id: data.id,
      step_number: stepTiming.stepNumber,
      started_at: stepTiming.startedAt,
      finished_at: stepTiming.finishedAt,
      duration_ms: stepTiming.durationMs,
      finish_reason: stepTiming.finishReason ?? null,
      raw_finish_reason: stepTiming.rawFinishReason ?? null,
      created_at: new Date().toISOString(),
    };
    const { error: stepErr } = await supabase
      .from("workflow_run_steps")
      .insert(row);
    if (stepErr && stepErr.code !== "23505") {
      throw stepErr;
    }
  }
}
