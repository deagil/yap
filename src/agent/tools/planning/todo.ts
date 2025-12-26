import { tool } from "ai";
import { z } from "zod";
import { todoItemSchema } from "../../types";

export const todoWriteTool = tool({
  description: `Create and manage a structured task list for the current session.

WHEN TO USE:
- Complex multi-step tasks requiring 3+ distinct steps
- After receiving new instructions - immediately capture requirements
- When starting work on a task - mark it as in_progress BEFORE beginning
- After completing a task - mark it as completed immediately

WHEN NOT TO USE:
- Single, straightforward tasks
- Trivial tasks requiring < 3 steps
- Purely conversational or informational queries

IMPORTANT:
- Only ONE task should be in_progress at a time
- Mark todos as completed as soon as done - do not batch
- Use this tool frequently to track progress and give visibility`,
  inputSchema: z.object({
    todos: z
      .array(todoItemSchema)
      .describe("The complete list of todo items. This replaces existing todos."),
  }),
  execute: async ({ todos }) => {
    return {
      success: true,
      message: `Updated task list with ${todos.length} items`,
      todos,
    };
  },
});

export const todoReadTool = tool({
  description: "Read the current todo list for the session.",
  inputSchema: z.object({}),
  execute: async () => {
    return {
      message: "Todo list is injected into context. Check the system state.",
    };
  },
});
