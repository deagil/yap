import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

type UserRow = {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
};

let userRowsForNextQuery: UserRow[] = [];
const usersWithPublicUsage = new Set<string>();

mock.module("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      if (table === "users") {
        return {
          select: () => ({
            ilike: async () => ({
              data: userRowsForNextQuery,
              error: null,
            }),
          }),
        };
      }
      if (table === "user_preferences") {
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              if (col !== "user_id") {
                throw new Error(`unexpected user_preferences.eq: ${col}`);
              }
              const uid = String(val);
              return {
                eq: () => ({
                  limit: async () => ({
                    data: usersWithPublicUsage.has(uid)
                      ? [{ public_usage_enabled: true }]
                      : [],
                    error: null,
                  }),
                }),
              };
            },
          }),
        };
      }
      throw new Error(`unexpected Supabase table: ${table}`);
    },
  }),
}));

const getUsageHistoryMock = mock(async () => []);
const getUsageInsightsMock = mock(async () => ({
  lookbackDays: 0,
  pr: {
    trackedPrCount: 0,
    sessionsWithPrCount: 0,
    openPrCount: 0,
    mergedPrCount: 0,
    closedPrCount: 0,
    mergeRate: 0,
  },
  efficiency: {
    mainAssistantTurnCount: 0,
    averageTokensPerMainTurn: 0,
    largestMainTurnTokens: 0,
    toolCallsPerMainTurn: 0,
    cacheReadRatio: 0,
  },
  code: {
    linesAdded: 0,
    linesRemoved: 0,
    totalLinesChanged: 0,
  },
  topRepositories: [],
}));

mock.module("./usage", () => ({
  getUsageHistoryAllWorkspaces: getUsageHistoryMock,
}));

mock.module("./usage-insights", () => ({
  getUsageInsightsAllWorkspaces: getUsageInsightsMock,
}));

const publicUsageProfileModulePromise = import("./public-usage-profile");

beforeEach(() => {
  userRowsForNextQuery = [];
  usersWithPublicUsage.clear();
  getUsageHistoryMock.mockClear();
  getUsageInsightsMock.mockClear();

  getUsageHistoryMock.mockImplementation(async () => []);
  getUsageInsightsMock.mockImplementation(async () => ({
    lookbackDays: 0,
    pr: {
      trackedPrCount: 0,
      sessionsWithPrCount: 0,
      openPrCount: 0,
      mergedPrCount: 0,
      closedPrCount: 0,
      mergeRate: 0,
    },
    efficiency: {
      mainAssistantTurnCount: 0,
      averageTokensPerMainTurn: 0,
      largestMainTurnTokens: 0,
      toolCallsPerMainTurn: 0,
      cacheReadRatio: 0,
    },
    code: {
      linesAdded: 0,
      linesRemoved: 0,
      totalLinesChanged: 0,
    },
    topRepositories: [],
  }));
});

describe("buildPublicUsageProfileData", () => {
  test("aggregates totals, agent split, and top models", async () => {
    const { buildPublicUsageProfileData } =
      await publicUsageProfileModulePromise;

    const result = buildPublicUsageProfileData({
      usage: [
        {
          date: "2026-02-01",
          source: "web",
          agentType: "main",
          provider: "anthropic",
          modelId: "anthropic/claude-sonnet-4",
          inputTokens: 100,
          cachedInputTokens: 20,
          outputTokens: 50,
          messageCount: 2,
          toolCallCount: 1,
        },
        {
          date: "2026-02-02",
          source: "web",
          agentType: "subagent",
          provider: "openai",
          modelId: "openai/gpt-5-mini",
          inputTokens: 60,
          cachedInputTokens: 0,
          outputTokens: 30,
          messageCount: 0,
          toolCallCount: 3,
        },
        {
          date: "2026-02-03",
          source: "web",
          agentType: "main",
          provider: "anthropic",
          modelId: "anthropic/claude-sonnet-4",
          inputTokens: 20,
          cachedInputTokens: 10,
          outputTokens: 10,
          messageCount: 1,
          toolCallCount: 0,
        },
      ],
      insights: {
        lookbackDays: 30,
        pr: {
          trackedPrCount: 2,
          sessionsWithPrCount: 2,
          openPrCount: 0,
          mergedPrCount: 2,
          closedPrCount: 0,
          mergeRate: 1,
        },
        efficiency: {
          mainAssistantTurnCount: 3,
          averageTokensPerMainTurn: 60,
          largestMainTurnTokens: 150,
          toolCallsPerMainTurn: 1.3,
          cacheReadRatio: 0.2,
        },
        code: {
          linesAdded: 40,
          linesRemoved: 12,
          totalLinesChanged: 52,
        },
        topRepositories: [
          {
            repoOwner: "vercel",
            repoName: "open-agents",
            sessionCount: 3,
            trackedPrCount: 2,
            linesAdded: 40,
            linesRemoved: 12,
            totalLinesChanged: 52,
          },
        ],
      },
    });

    expect(result).toEqual({
      totals: {
        inputTokens: 180,
        cachedInputTokens: 30,
        outputTokens: 90,
        messageCount: 3,
        toolCallCount: 4,
        totalTokens: 270,
      },
      agentSplit: {
        mainTokens: 180,
        subagentTokens: 90,
      },
      topModels: [
        {
          modelId: "anthropic/claude-sonnet-4",
          provider: "anthropic",
          label: "claude-sonnet-4",
          totalTokens: 180,
          inputTokens: 120,
          cachedInputTokens: 30,
          outputTokens: 60,
          messageCount: 3,
          toolCallCount: 1,
        },
        {
          modelId: "openai/gpt-5-mini",
          provider: "openai",
          label: "gpt-5-mini",
          totalTokens: 90,
          inputTokens: 60,
          cachedInputTokens: 0,
          outputTokens: 30,
          messageCount: 0,
          toolCallCount: 3,
        },
      ],
      topRepositories: [
        {
          repoOwner: "vercel",
          repoName: "open-agents",
          sessionCount: 3,
          trackedPrCount: 2,
          linesAdded: 40,
          linesRemoved: 12,
          totalLinesChanged: 52,
        },
      ],
      dailyActivity: [
        {
          date: "2026-02-01",
          inputTokens: 100,
          outputTokens: 50,
          messageCount: 2,
          toolCallCount: 1,
        },
        {
          date: "2026-02-02",
          inputTokens: 60,
          outputTokens: 30,
          messageCount: 0,
          toolCallCount: 3,
        },
        {
          date: "2026-02-03",
          inputTokens: 20,
          outputTokens: 10,
          messageCount: 1,
          toolCallCount: 0,
        },
      ],
      hasUsage: true,
    });
  });

  test("returns empty state when usage is empty", async () => {
    const { buildPublicUsageProfileData } =
      await publicUsageProfileModulePromise;

    expect(
      buildPublicUsageProfileData({
        usage: [],
        insights: await getUsageInsightsMock(),
      }),
    ).toEqual({
      totals: {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        messageCount: 0,
        toolCallCount: 0,
        totalTokens: 0,
      },
      agentSplit: {
        mainTokens: 0,
        subagentTokens: 0,
      },
      topModels: [],
      topRepositories: [],
      dailyActivity: [],
      hasUsage: false,
    });
  });
});

describe("getPublicUsageProfile", () => {
  test("returns null when the user does not exist", async () => {
    const { getPublicUsageProfile } = await publicUsageProfileModulePromise;

    userRowsForNextQuery = [];

    expect(await getPublicUsageProfile("missing-user", null)).toBeNull();
    expect(getUsageHistoryMock).not.toHaveBeenCalled();
    expect(getUsageInsightsMock).not.toHaveBeenCalled();
  });

  test("returns null when public usage is disabled", async () => {
    const { getPublicUsageProfile } = await publicUsageProfileModulePromise;

    userRowsForNextQuery = [
      {
        id: "user-1",
        username: "private-user",
        name: "Private User",
        avatar_url: null,
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];

    expect(await getPublicUsageProfile("private-user", null)).toBeNull();
    expect(getUsageHistoryMock).not.toHaveBeenCalled();
    expect(getUsageInsightsMock).not.toHaveBeenCalled();
  });

  test("uses all-time queries when no valid date is provided", async () => {
    const { getPublicUsageProfile } = await publicUsageProfileModulePromise;

    userRowsForNextQuery = [
      {
        id: "user-2",
        username: "all-time-user",
        name: null,
        avatar_url: null,
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ];
    usersWithPublicUsage.add("user-2");

    const profile = await getPublicUsageProfile("all-time-user", "bad-value");

    expect(profile?.dateSelection).toEqual({
      kind: "all",
      value: null,
      label: "All time",
      range: null,
    });
    expect(profile?.invalidDateError).toBeTruthy();
    expect(getUsageHistoryMock).toHaveBeenCalledWith("user-2", {
      allTime: true,
    });
    expect(getUsageInsightsMock).toHaveBeenCalledWith("user-2", {
      allTime: true,
    });
  });

  test("prefers an enabled case-insensitive match", async () => {
    const { getPublicUsageProfile } = await publicUsageProfileModulePromise;

    userRowsForNextQuery = [
      {
        id: "user-disabled",
        username: "range-user",
        name: "Disabled User",
        avatar_url: null,
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "user-3",
        username: "Range-User",
        name: "Range User",
        avatar_url: null,
        updated_at: "2026-01-03T00:00:00.000Z",
      },
    ];
    usersWithPublicUsage.add("user-3");

    const profile = await getPublicUsageProfile(
      "RANGE-USER",
      "2026-01-01..2026-01-31",
    );

    expect(profile?.user).toEqual({
      id: "user-3",
      username: "Range-User",
      name: "Range User",
      avatarUrl: null,
    });
    expect(profile?.dateSelection).toEqual({
      kind: "range",
      value: "2026-01-01..2026-01-31",
      label: "Jan 1, 2026 – Jan 31, 2026",
      range: {
        from: "2026-01-01",
        to: "2026-01-31",
      },
    });
    expect(getUsageHistoryMock).toHaveBeenCalledWith("user-3", {
      range: {
        from: "2026-01-01",
        to: "2026-01-31",
      },
    });
    expect(getUsageInsightsMock).toHaveBeenCalledWith("user-3", {
      range: {
        from: "2026-01-01",
        to: "2026-01-31",
      },
    });
  });
});
