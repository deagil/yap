import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  type LanguageModelUsage,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { Chat } from "@ai-sdk/react";
import { createAgentTransport } from "./transport.js";
import type {
  TUIAgent,
  TUIAgentCallOptions,
  TUIAgentUIMessage,
  AutoAcceptMode,
} from "./types.js";
import { getContextLimit } from "../agent/utils/model-context-limits.js";

type ChatState = {
  model?: string;
  autoAcceptMode: AutoAcceptMode;
  workingDirectory?: string;
  usage: LanguageModelUsage;
  contextLimit: number;
};

type ChatContextValue = {
  chat: Chat<TUIAgentUIMessage>;
  state: ChatState;
  setAutoAcceptMode: (mode: AutoAcceptMode) => void;
  cycleAutoAcceptMode: () => void;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const AUTO_ACCEPT_MODES: AutoAcceptMode[] = ["off", "edits", "all"];

type ChatProviderProps = {
  children: ReactNode;
  agent: TUIAgent;
  agentOptions: TUIAgentCallOptions;
  model?: string;
  workingDirectory?: string;
};

const DEFAULT_USAGE: LanguageModelUsage = {
  inputTokens: undefined,
  outputTokens: undefined,
  totalTokens: undefined,
  inputTokenDetails: {
    noCacheTokens: undefined,
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
  },
  outputTokenDetails: {
    textTokens: undefined,
    reasoningTokens: undefined,
  },
};

export function ChatProvider({
  children,
  agent,
  agentOptions,
  model,
  workingDirectory,
}: ChatProviderProps) {
  const [autoAcceptMode, setAutoAcceptMode] = useState<AutoAcceptMode>("edits");
  const [usage, setUsage] = useState<LanguageModelUsage>(DEFAULT_USAGE);

  const contextLimit = useMemo(() => getContextLimit(model ?? ""), [model]);

  const handleUsageUpdate = useCallback((newUsage: LanguageModelUsage) => {
    setUsage(newUsage);
  }, []);

  const transport = useMemo(
    () =>
      createAgentTransport({
        agent,
        agentOptions,
        onUsageUpdate: handleUsageUpdate,
      }),
    [agent, agentOptions, handleUsageUpdate],
  );

  const chat = useMemo(
    () =>
      new Chat<TUIAgentUIMessage>({
        transport,
        sendAutomaticallyWhen:
          lastAssistantMessageIsCompleteWithApprovalResponses,
      }),
    [transport],
  );

  const state: ChatState = useMemo(
    () => ({
      model,
      autoAcceptMode,
      workingDirectory,
      usage,
      contextLimit,
    }),
    [model, autoAcceptMode, workingDirectory, usage, contextLimit],
  );

  const cycleAutoAcceptMode = () => {
    setAutoAcceptMode((prev) => {
      const currentIndex = AUTO_ACCEPT_MODES.indexOf(prev);
      const nextIndex = (currentIndex + 1) % AUTO_ACCEPT_MODES.length;
      return AUTO_ACCEPT_MODES[nextIndex] ?? "off";
    });
  };

  return (
    <ChatContext.Provider
      value={{
        chat,
        state,
        setAutoAcceptMode,
        cycleAutoAcceptMode,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
