import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SandboxType } from "@/components/sandbox-selector-compact";
import { modelVariantsSchema, type ModelVariant } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import {
  normalizeGlobalSkillRefs,
  type GlobalSkillRef,
} from "@/lib/skills/global-skill-refs";
import { createServerSupabase } from "@/lib/supabase/server";

export type DiffMode = "unified" | "split";

export interface UserPreferencesData {
  defaultModelId: string;
  defaultSubagentModelId: string | null;
  defaultSandboxType: SandboxType;
  defaultDiffMode: DiffMode;
  autoCommitPush: boolean;
  autoCreatePr: boolean;
  alertsEnabled: boolean;
  alertSoundEnabled: boolean;
  publicUsageEnabled: boolean;
  globalSkillRefs: GlobalSkillRef[];
  modelVariants: ModelVariant[];
  enabledModelIds: string[];
}

const DEFAULT_PREFERENCES: UserPreferencesData = {
  defaultModelId: APP_DEFAULT_MODEL_ID,
  defaultSubagentModelId: null,
  defaultSandboxType: "vercel",
  defaultDiffMode: "unified",
  autoCommitPush: false,
  autoCreatePr: false,
  alertsEnabled: true,
  alertSoundEnabled: true,
  publicUsageEnabled: false,
  globalSkillRefs: [],
  modelVariants: [],
  enabledModelIds: [],
};

const VALID_SANDBOX_TYPES: SandboxType[] = ["vercel"];
const VALID_DIFF_MODES: DiffMode[] = ["unified", "split"];

function normalizeSandboxType(value: unknown): SandboxType {
  if (value === "hybrid") {
    return "vercel";
  }

  if (
    typeof value === "string" &&
    VALID_SANDBOX_TYPES.includes(value as SandboxType)
  ) {
    return value as SandboxType;
  }

  return DEFAULT_PREFERENCES.defaultSandboxType;
}

function normalizeDiffMode(value: unknown): DiffMode {
  if (
    typeof value === "string" &&
    VALID_DIFF_MODES.includes(value as DiffMode)
  ) {
    return value as DiffMode;
  }

  return DEFAULT_PREFERENCES.defaultDiffMode;
}

function normalizeEnabledModelIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function mapRowToData(
  row: Record<string, unknown> | undefined,
): UserPreferencesData {
  const parsedModelVariants = modelVariantsSchema.safeParse(
    row?.model_variants ?? [],
  );

  return {
    defaultModelId:
      (row?.default_model_id as string | undefined) ??
      DEFAULT_PREFERENCES.defaultModelId,
    defaultSubagentModelId:
      (row?.default_subagent_model_id as string | null | undefined) ?? null,
    defaultSandboxType: normalizeSandboxType(row?.default_sandbox_type),
    defaultDiffMode: normalizeDiffMode(row?.default_diff_mode),
    autoCommitPush:
      (row?.auto_commit_push as boolean | undefined) ??
      DEFAULT_PREFERENCES.autoCommitPush,
    autoCreatePr:
      (row?.auto_create_pr as boolean | undefined) ??
      DEFAULT_PREFERENCES.autoCreatePr,
    alertsEnabled:
      (row?.alerts_enabled as boolean | undefined) ??
      DEFAULT_PREFERENCES.alertsEnabled,
    alertSoundEnabled:
      (row?.alert_sound_enabled as boolean | undefined) ??
      DEFAULT_PREFERENCES.alertSoundEnabled,
    publicUsageEnabled:
      (row?.public_usage_enabled as boolean | undefined) ??
      DEFAULT_PREFERENCES.publicUsageEnabled,
    globalSkillRefs: normalizeGlobalSkillRefs(
      row?.global_skill_refs as GlobalSkillRef[] | undefined,
    ),
    modelVariants: parsedModelVariants.success ? parsedModelVariants.data : [],
    enabledModelIds: normalizeEnabledModelIds(row?.enabled_model_ids),
  };
}

export function toUserPreferencesData(
  row?: Record<string, unknown>,
): UserPreferencesData {
  return mapRowToData(row);
}

async function db(client?: SupabaseClient) {
  return client ?? (await createServerSupabase());
}

/**
 * Get user preferences for a workspace, creating defaults if none exist.
 */
export async function getUserPreferences(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
): Promise<UserPreferencesData> {
  const supabase = await db(client);
  const { data: existing, error } = await supabase
    .from("user_preferences")
    .select()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  return mapRowToData(existing as Record<string, unknown> | undefined);
}

/**
 * Update user preferences for a workspace, creating if they don't exist.
 */
export async function updateUserPreferences(
  userId: string,
  workspaceId: string,
  updates: Partial<UserPreferencesData>,
  client?: SupabaseClient,
): Promise<UserPreferencesData> {
  const supabase = await db(client);
  const { data: existing, error: selErr } = await supabase
    .from("user_preferences")
    .select()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (selErr) {
    throw selErr;
  }

  const now = new Date().toISOString();

  if (existing) {
    const patch: Record<string, unknown> = { updated_at: now };
    if (updates.defaultModelId !== undefined) {
      patch.default_model_id = updates.defaultModelId;
    }
    if (updates.defaultSubagentModelId !== undefined) {
      patch.default_subagent_model_id = updates.defaultSubagentModelId;
    }
    if (updates.defaultSandboxType !== undefined) {
      patch.default_sandbox_type = updates.defaultSandboxType;
    }
    if (updates.defaultDiffMode !== undefined) {
      patch.default_diff_mode = updates.defaultDiffMode;
    }
    if (updates.autoCommitPush !== undefined) {
      patch.auto_commit_push = updates.autoCommitPush;
    }
    if (updates.autoCreatePr !== undefined) {
      patch.auto_create_pr = updates.autoCreatePr;
    }
    if (updates.alertsEnabled !== undefined) {
      patch.alerts_enabled = updates.alertsEnabled;
    }
    if (updates.alertSoundEnabled !== undefined) {
      patch.alert_sound_enabled = updates.alertSoundEnabled;
    }
    if (updates.publicUsageEnabled !== undefined) {
      patch.public_usage_enabled = updates.publicUsageEnabled;
    }
    if (updates.globalSkillRefs !== undefined) {
      patch.global_skill_refs = updates.globalSkillRefs;
    }
    if (updates.modelVariants !== undefined) {
      patch.model_variants = updates.modelVariants;
    }
    if (updates.enabledModelIds !== undefined) {
      patch.enabled_model_ids = updates.enabledModelIds;
    }

    const { data: updated, error } = await supabase
      .from("user_preferences")
      .update(patch)
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return mapRowToData(updated as Record<string, unknown>);
  }

  const { data: created, error: insErr } = await supabase
    .from("user_preferences")
    .insert({
      id: nanoid(),
      user_id: userId,
      workspace_id: workspaceId,
      default_model_id:
        updates.defaultModelId ?? DEFAULT_PREFERENCES.defaultModelId,
      default_subagent_model_id: updates.defaultSubagentModelId ?? null,
      default_sandbox_type:
        updates.defaultSandboxType ?? DEFAULT_PREFERENCES.defaultSandboxType,
      default_diff_mode:
        updates.defaultDiffMode ?? DEFAULT_PREFERENCES.defaultDiffMode,
      auto_commit_push:
        updates.autoCommitPush ?? DEFAULT_PREFERENCES.autoCommitPush,
      auto_create_pr: updates.autoCreatePr ?? DEFAULT_PREFERENCES.autoCreatePr,
      alerts_enabled:
        updates.alertsEnabled ?? DEFAULT_PREFERENCES.alertsEnabled,
      alert_sound_enabled:
        updates.alertSoundEnabled ?? DEFAULT_PREFERENCES.alertSoundEnabled,
      public_usage_enabled:
        updates.publicUsageEnabled ?? DEFAULT_PREFERENCES.publicUsageEnabled,
      global_skill_refs:
        updates.globalSkillRefs ?? DEFAULT_PREFERENCES.globalSkillRefs,
      model_variants:
        updates.modelVariants ?? DEFAULT_PREFERENCES.modelVariants,
      enabled_model_ids:
        updates.enabledModelIds ?? DEFAULT_PREFERENCES.enabledModelIds,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (insErr) {
    throw insErr;
  }
  return mapRowToData(created as Record<string, unknown>);
}
