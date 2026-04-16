import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const userPreferencesModulePromise = import("./user-preferences");

describe("toUserPreferencesData", () => {
  test("returns defaults when row is undefined", async () => {
    const { toUserPreferencesData } = await userPreferencesModulePromise;

    expect(toUserPreferencesData()).toEqual({
      defaultModelId: "openai/gpt-5.4",
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
    });
  });

  test("normalizes invalid sandbox and diff mode values to defaults", async () => {
    const { toUserPreferencesData } = await userPreferencesModulePromise;

    const result = toUserPreferencesData({
      default_model_id: "openai/gpt-5",
      default_subagent_model_id: "openai/gpt-5-mini",
      default_sandbox_type: "invalid",
      default_diff_mode: "invalid",
      auto_commit_push: false,
      auto_create_pr: false,
      alerts_enabled: true,
      alert_sound_enabled: true,
      public_usage_enabled: false,
      global_skill_refs: [],
      model_variants: [],
      enabled_model_ids: [],
    });

    expect(result.defaultSandboxType).toBe("vercel");
    expect(result.defaultDiffMode).toBe("unified");
  });

  test("normalizes legacy hybrid sandbox types to vercel", async () => {
    const { toUserPreferencesData } = await userPreferencesModulePromise;

    const result = toUserPreferencesData({
      default_model_id: "openai/gpt-5",
      default_subagent_model_id: null,
      default_sandbox_type: "hybrid",
      default_diff_mode: "unified",
      auto_commit_push: false,
      auto_create_pr: false,
      alerts_enabled: true,
      alert_sound_enabled: true,
      public_usage_enabled: false,
      global_skill_refs: [],
      model_variants: [],
      enabled_model_ids: [],
    });

    expect(result.defaultSandboxType).toBe("vercel");
    expect(result.defaultDiffMode).toBe("unified");
  });

  test("drops invalid globalSkillRefs payloads", async () => {
    const { toUserPreferencesData } = await userPreferencesModulePromise;

    const result = toUserPreferencesData({
      default_model_id: "openai/gpt-5",
      default_subagent_model_id: null,
      default_sandbox_type: "vercel",
      default_diff_mode: "split",
      auto_commit_push: false,
      auto_create_pr: false,
      alerts_enabled: true,
      alert_sound_enabled: true,
      public_usage_enabled: false,
      global_skill_refs: [{ source: "vercel/ai", skillName: "bad name" }],
      model_variants: [],
      enabled_model_ids: [],
    });

    expect(result.globalSkillRefs).toEqual([]);
  });

  test("keeps valid globalSkillRefs payloads", async () => {
    const { toUserPreferencesData } = await userPreferencesModulePromise;

    const result = toUserPreferencesData({
      default_model_id: "openai/gpt-5",
      default_subagent_model_id: null,
      default_sandbox_type: "vercel",
      default_diff_mode: "split",
      auto_commit_push: false,
      auto_create_pr: false,
      alerts_enabled: true,
      alert_sound_enabled: true,
      public_usage_enabled: false,
      global_skill_refs: [
        { source: "vercel/ai", skillName: "ai-sdk" },
        { source: "vercel/ai", skillName: "ai-sdk" },
      ],
      model_variants: [],
      enabled_model_ids: [],
    });

    expect(result.globalSkillRefs).toEqual([
      { source: "vercel/ai", skillName: "ai-sdk" },
    ]);
  });

  test("drops invalid modelVariants payloads", async () => {
    const { toUserPreferencesData } = await userPreferencesModulePromise;

    const result = toUserPreferencesData({
      default_model_id: "openai/gpt-5",
      default_subagent_model_id: null,
      default_sandbox_type: "vercel",
      default_diff_mode: "split",
      auto_commit_push: false,
      auto_create_pr: false,
      alerts_enabled: true,
      alert_sound_enabled: true,
      public_usage_enabled: false,
      global_skill_refs: [],
      model_variants: [{ id: "bad-id" }],
      enabled_model_ids: [],
    });

    expect(result.modelVariants).toEqual([]);
  });

  test("keeps valid modelVariants payloads", async () => {
    const { toUserPreferencesData } = await userPreferencesModulePromise;

    const result = toUserPreferencesData({
      default_model_id: "openai/gpt-5",
      default_subagent_model_id: null,
      default_sandbox_type: "vercel",
      default_diff_mode: "split",
      auto_commit_push: true,
      auto_create_pr: true,
      alerts_enabled: true,
      alert_sound_enabled: true,
      public_usage_enabled: false,
      global_skill_refs: [],
      model_variants: [
        {
          id: "variant:test",
          name: "Test Variant",
          baseModelId: "openai/gpt-5",
          providerOptions: { reasoningEffort: "low" },
        },
      ],
      enabled_model_ids: [],
    });

    expect(result).toEqual({
      defaultModelId: "openai/gpt-5",
      defaultSubagentModelId: null,
      defaultSandboxType: "vercel",
      defaultDiffMode: "split",
      autoCommitPush: true,
      autoCreatePr: true,
      alertsEnabled: true,
      alertSoundEnabled: true,
      publicUsageEnabled: false,
      globalSkillRefs: [],
      modelVariants: [
        {
          id: "variant:test",
          name: "Test Variant",
          baseModelId: "openai/gpt-5",
          providerOptions: { reasoningEffort: "low" },
        },
      ],
      enabledModelIds: [],
    });
  });

  test("keeps publicUsageEnabled when provided", async () => {
    const { toUserPreferencesData } = await userPreferencesModulePromise;

    const result = toUserPreferencesData({
      default_model_id: "openai/gpt-5",
      default_subagent_model_id: null,
      default_sandbox_type: "vercel",
      default_diff_mode: "split",
      auto_commit_push: false,
      auto_create_pr: false,
      alerts_enabled: true,
      alert_sound_enabled: true,
      public_usage_enabled: true,
      global_skill_refs: [],
      model_variants: [],
      enabled_model_ids: [],
    });

    expect(result.publicUsageEnabled).toBe(true);
  });
});
