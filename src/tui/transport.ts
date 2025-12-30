import {
  type ChatTransport,
  type LanguageModelUsage,
  convertToModelMessages,
  smoothStream,
} from "ai";
import type { TUIAgent, TUIAgentCallOptions, TUIAgentUIMessage } from "./types";

export type AgentTransportOptions = {
  agent: TUIAgent;
  agentOptions: TUIAgentCallOptions;
  onUsageUpdate?: (usage: LanguageModelUsage) => void;
};

export function createAgentTransport({
  agent,
  agentOptions,
  onUsageUpdate,
}: AgentTransportOptions): ChatTransport<TUIAgentUIMessage> {
  return {
    sendMessages: async ({ messages, abortSignal }) => {
      // Pass the agent's tools so convertToModelMessages can properly handle
      // tool approval responses for locally-executed tools
      const modelMessages = await convertToModelMessages(messages, {
        tools: agent.tools,
      });

      const result = await agent.stream({
        messages: modelMessages,
        options: agentOptions,
        abortSignal: abortSignal ?? undefined,
        experimental_transform: smoothStream(),
      });

      // Capture usage after stream completes (non-blocking)
      result.totalUsage.then((usage) => {
        onUsageUpdate?.(usage);
      });

      return result.toUIMessageStream();
    },

    reconnectToStream: async () => {
      // Not supported for local agent calls
      return null;
    },
  };
}
