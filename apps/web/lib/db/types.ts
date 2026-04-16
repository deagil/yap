import type { SandboxState } from "@open-harness/sandbox";
import type { ModelVariant } from "@/lib/model-variants";
import type { GlobalSkillRef } from "@/lib/skills/global-skill-refs";

export type Session = {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  status: "running" | "completed" | "failed" | "archived";
  repoOwner: string | null;
  repoName: string | null;
  branch: string | null;
  cloneUrl: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  vercelTeamId: string | null;
  vercelTeamSlug: string | null;
  isNewBranch: boolean;
  autoCommitPushOverride: boolean | null;
  autoCreatePrOverride: boolean | null;
  globalSkillRefs: GlobalSkillRef[];
  sandboxState: SandboxState | null | undefined;
  lifecycleState:
    | "provisioning"
    | "active"
    | "hibernating"
    | "hibernated"
    | "restoring"
    | "archived"
    | "failed"
    | null
    | undefined;
  lifecycleVersion: number;
  lastActivityAt: Date | null;
  sandboxExpiresAt: Date | null;
  hibernateAfter: Date | null;
  lifecycleRunId: string | null;
  lifecycleError: string | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  prNumber: number | null;
  prStatus: "open" | "merged" | "closed" | null;
  snapshotUrl: string | null;
  snapshotCreatedAt: Date | null;
  snapshotSizeBytes: number | null;
  cachedDiff: unknown;
  cachedDiffUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewSession = Omit<
  Session,
  "createdAt" | "updatedAt" | "lifecycleVersion"
> & {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
  lifecycleVersion?: number;
};

export type Chat = {
  id: string;
  workspaceId: string;
  sessionId: string;
  title: string;
  modelId: string | null;
  activeStreamId: string | null;
  lastAssistantMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewChat = Omit<Chat, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type Share = {
  id: string;
  workspaceId: string;
  chatId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewShare = Omit<Share, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type ChatMessage = {
  id: string;
  workspaceId: string;
  chatId: string;
  role: "user" | "assistant";
  parts: unknown;
  createdAt: Date;
};

export type NewChatMessage = Omit<ChatMessage, "createdAt"> & {
  createdAt?: Date;
};

export type ChatRead = {
  userId: string;
  workspaceId: string;
  chatId: string;
  lastReadAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type NewChatRead = Omit<ChatRead, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type WorkflowRun = {
  id: string;
  workspaceId: string;
  chatId: string;
  sessionId: string;
  userId: string;
  modelId: string | null;
  status: "completed" | "aborted" | "failed";
  startedAt: Date;
  finishedAt: Date;
  totalDurationMs: number;
  slackChannelId: string | null;
  createdAt: Date;
};

export type WorkflowRunStep = {
  id: string;
  workspaceId: string;
  workflowRunId: string;
  stepNumber: number;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  finishReason: string | null;
  rawFinishReason: string | null;
  createdAt: Date;
};

export type GitHubInstallation = {
  id: string;
  workspaceId: string;
  userId: string;
  installationId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  repositorySelection: "all" | "selected";
  installationUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewGitHubInstallation = Omit<
  GitHubInstallation,
  "createdAt" | "updatedAt"
> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type VercelProjectLink = {
  workspaceId: string;
  userId: string;
  repoOwner: string;
  repoName: string;
  projectId: string;
  projectName: string;
  teamId: string | null;
  teamSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewVercelProjectLink = Omit<
  VercelProjectLink,
  "createdAt" | "updatedAt"
> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type LinkedAccount = {
  id: string;
  workspaceId: string;
  userId: string;
  provider: "slack" | "discord" | "whatsapp" | "telegram";
  externalId: string;
  providerWorkspaceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewLinkedAccount = Omit<
  LinkedAccount,
  "createdAt" | "updatedAt"
> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type UserPreferences = {
  id: string;
  workspaceId: string;
  userId: string;
  defaultModelId: string | null;
  defaultSubagentModelId: string | null;
  defaultSandboxType: "vercel";
  defaultDiffMode: "unified" | "split";
  autoCommitPush: boolean;
  autoCreatePr: boolean;
  alertsEnabled: boolean;
  alertSoundEnabled: boolean;
  publicUsageEnabled: boolean;
  globalSkillRefs: GlobalSkillRef[];
  modelVariants: ModelVariant[];
  enabledModelIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type NewUserPreferences = Omit<
  UserPreferences,
  "createdAt" | "updatedAt"
> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type UsageEvent = {
  id: string;
  workspaceId: string;
  userId: string;
  source: "web";
  agentType: "main" | "subagent";
  provider: string | null;
  modelId: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  toolCallCount: number;
  createdAt: Date;
};
