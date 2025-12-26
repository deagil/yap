import { ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import {
  todoWriteTool,
  readFileTool,
  writeFileTool,
  editFileTool,
  grepTool,
  globTool,
  bashTool,
  taskTool,
  memorySaveTool,
  memoryRecallTool,
} from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import {
  createAgentState,
  updateTodos,
  formatTodosForContext,
  formatScratchpadForContext,
} from "./state";
import type { AgentState, TodoItem } from "./types";

export interface DeepAgentOptions {
  model?: string;
  workingDirectory?: string;
  customInstructions?: string;
  maxSteps?: number;
}

export function createDeepAgent(options: DeepAgentOptions = {}) {
  const {
    model = "anthropic/claude-sonnet-4-20250514",
    workingDirectory = process.cwd(),
    customInstructions,
    maxSteps = 50,
  } = options;

  let agentState: AgentState = createAgentState(workingDirectory);

  const agent = new ToolLoopAgent({
    model,
    instructions: buildSystemPrompt({ customInstructions }),
    tools: {
      todo_write: todoWriteTool,
      read: readFileTool,
      write: writeFileTool,
      edit: editFileTool,
      grep: grepTool,
      glob: globTool,
      bash: bashTool,
      task: taskTool,
      memory_save: memorySaveTool,
      memory_recall: memoryRecallTool,
    },
    stopWhen: stepCountIs(maxSteps),
    experimental_context: { workingDirectory },
    callOptionsSchema: z.object({
      workingDirectory: z.string().optional(),
    }),
    prepareCall: ({ options: callOptions, ...settings }) => {
      const cwd = callOptions?.workingDirectory ?? workingDirectory;

      const todosContext = formatTodosForContext(agentState.todos);
      const scratchpadContext = formatScratchpadForContext(agentState.scratchpad);

      return {
        ...settings,
        instructions: buildSystemPrompt({
          customInstructions,
          todosContext,
          scratchpadContext,
        }),
        experimental_context: { workingDirectory: cwd },
      };
    },
    onStepFinish: ({ toolResults }) => {
      for (const result of toolResults) {
        if (result.toolName === "todo_write" && "output" in result) {
          const output = result.output as { todos?: TodoItem[] } | undefined;
          if (output?.todos) {
            agentState = updateTodos(agentState, output.todos);
          }
        }
      }
    },
  });

  return {
    agent,
    getState: () => agentState,
    resetState: () => {
      agentState = createAgentState(workingDirectory);
    },
  };
}

export type DeepAgent = ReturnType<typeof createDeepAgent>;
