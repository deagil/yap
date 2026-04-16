import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

type UpsertMode = "inserted" | "updated" | "conflict";

let upsertMode: UpsertMode = "inserted";

let fakeSelectRows: { title: string }[] = [];

const fakeDbMessageRow = {
  id: "message-1",
  workspace_id: "workspace-1",
  chat_id: "chat-1",
  role: "assistant",
  parts: { id: "message-1", role: "assistant", parts: [] },
  created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
};

function fakeSupabase() {
  return {
    from(table: string) {
      if (table === "sessions") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: fakeSelectRows,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "chat_messages") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: async () => {
                if (upsertMode === "inserted") {
                  return { data: { ...fakeDbMessageRow }, error: null };
                }
                return {
                  data: null,
                  error: { code: "23505", message: "duplicate" },
                };
              },
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    maybeSingle: async () => {
                      if (upsertMode === "updated") {
                        return { data: { ...fakeDbMessageRow }, error: null };
                      }
                      return { data: null, error: null };
                    },
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

mock.module("@/lib/supabase/server", () => ({
  createServerSupabase: async () => fakeSupabase(),
}));

const sessionsModulePromise = import("./sessions");

describe("normalizeLegacySandboxState", () => {
  test("rewrites legacy vercel-compatible sandbox ids onto sandboxName", async () => {
    const { normalizeLegacySandboxState } = await sessionsModulePromise;

    const result = normalizeLegacySandboxState({
      type: "hybrid",
      sandboxId: "sbx-legacy-1",
      snapshotId: "snap-legacy-1",
      expiresAt: 123,
    });

    expect(result).toEqual({
      type: "vercel",
      sandboxName: "sbx-legacy-1",
      snapshotId: "snap-legacy-1",
      expiresAt: 123,
    });
  });

  test("moves persisted session_<id> identifiers onto sandboxName", async () => {
    const { normalizeLegacySandboxState } = await sessionsModulePromise;

    expect(
      normalizeLegacySandboxState({
        type: "vercel",
        sandboxId: "session_123",
        expiresAt: 456,
      }),
    ).toEqual({
      type: "vercel",
      sandboxName: "session_123",
      expiresAt: 456,
    });
  });

  test("leaves supported sandbox states unchanged", async () => {
    const { normalizeLegacySandboxState } = await sessionsModulePromise;

    const state = {
      type: "vercel",
      sandboxName: "session_current-1",
      expiresAt: 456,
    } as const;

    expect(normalizeLegacySandboxState(state)).toEqual(state);
  });
});

describe("getUsedSessionTitles", () => {
  beforeEach(() => {
    fakeSelectRows = [];
  });

  test("returns an empty Set when the user has no sessions", async () => {
    const { getUsedSessionTitles } = await sessionsModulePromise;
    fakeSelectRows = [];

    const result = await getUsedSessionTitles("user-1", "workspace-1");
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  test("returns a Set containing all existing session titles", async () => {
    const { getUsedSessionTitles } = await sessionsModulePromise;
    fakeSelectRows = [
      { title: "Tokyo" },
      { title: "Paris" },
      { title: "Lagos" },
    ];

    const result = await getUsedSessionTitles("user-1", "workspace-1");
    expect(result.size).toBe(3);
    expect(result.has("Tokyo")).toBe(true);
    expect(result.has("Paris")).toBe(true);
    expect(result.has("Lagos")).toBe(true);
  });

  test("deduplicates titles if the DB returns duplicates", async () => {
    const { getUsedSessionTitles } = await sessionsModulePromise;
    fakeSelectRows = [{ title: "Rome" }, { title: "Rome" }];

    const result = await getUsedSessionTitles("user-1", "workspace-1");
    expect(result.size).toBe(1);
    expect(result.has("Rome")).toBe(true);
  });
});

describe("upsertChatMessageScoped", () => {
  beforeEach(() => {
    upsertMode = "inserted";
  });

  test("returns inserted when no existing row conflicts", async () => {
    const { upsertChatMessageScoped } = await sessionsModulePromise;
    upsertMode = "inserted";

    const result = await upsertChatMessageScoped({
      id: "message-1",
      workspaceId: "workspace-1",
      chatId: "chat-1",
      role: "assistant",
      parts: { id: "message-1", role: "assistant", parts: [] },
    });

    expect(result.status).toBe("inserted");
  });

  test("returns updated when id exists in same chat and role", async () => {
    const { upsertChatMessageScoped } = await sessionsModulePromise;
    upsertMode = "updated";

    const result = await upsertChatMessageScoped({
      id: "message-1",
      workspaceId: "workspace-1",
      chatId: "chat-1",
      role: "assistant",
      parts: { id: "message-1", role: "assistant", parts: [{ type: "text" }] },
    });

    expect(result.status).toBe("updated");
  });

  test("returns conflict when id exists for different chat/role scope", async () => {
    const { upsertChatMessageScoped } = await sessionsModulePromise;
    upsertMode = "conflict";

    const result = await upsertChatMessageScoped({
      id: "message-1",
      workspaceId: "workspace-1",
      chatId: "chat-1",
      role: "assistant",
      parts: { id: "message-1", role: "assistant", parts: [{ type: "text" }] },
    });

    expect(result.status).toBe("conflict");
  });
});
