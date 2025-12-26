import { tool, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import { readFileTool } from "../context/read";
import { writeFileTool, editFileTool } from "../context/write";
import { grepTool } from "../context/grep";
import { globTool } from "../context/glob";
import { bashTool } from "../context/bash";

const SUBAGENT_SYSTEM_PROMPT = `You are a task executor - a focused subagent that completes specific, well-defined tasks.

IMPORTANT:
- You work autonomously without asking follow-up questions
- Complete the task fully before returning
- Return a concise summary of what you accomplished
- If you encounter blockers, document them in your response

You have access to file operations and bash commands. Use them to complete your task.`;

export const taskTool = tool({
  description: `Spawn an ephemeral subagent to perform a complex, multi-step task.

WHEN TO USE:
- Feature scaffolding across multiple files
- Cross-layer refactors
- Mass migrations or boilerplate generation
- Any task requiring many tool calls that would clutter the main context

WHEN NOT TO USE:
- Exploratory work or research (use grep/glob directly)
- Architectural decisions (use oracle instead)
- Simple single-file edits

HOW TO USE:
- Provide detailed instructions with clear deliverables
- Include step-by-step procedures and validation steps
- Specify constraints (coding style, patterns to follow)
- Include relevant context snippets or examples

The subagent returns only a summary - its full context is isolated from the parent.`,
  inputSchema: z.object({
    task: z
      .string()
      .describe("Short description of the task (displayed to user)"),
    instructions: z.string().describe(
      `Detailed instructions for the subagent. Include:
- Goal and deliverables
- Step-by-step procedure
- Constraints and patterns to follow
- How to verify the work`
    ),
    workingDirectory: z
      .string()
      .optional()
      .describe("Working directory for the subagent"),
  }),
  execute: async ({ task, instructions, workingDirectory }) => {
    try {
      const cwd = workingDirectory ?? process.cwd();

      const subagent = new ToolLoopAgent({
        model: "anthropic/claude-sonnet-4-20250514",
        instructions: SUBAGENT_SYSTEM_PROMPT,
        tools: {
          read: readFileTool,
          write: writeFileTool,
          edit: editFileTool,
          grep: grepTool,
          glob: globTool,
          bash: bashTool,
        },
        stopWhen: stepCountIs(30),
      });

      const result = await subagent.generate({
        prompt: `Working directory: ${cwd}

## Task
${task}

## Instructions
${instructions}

Complete this task and provide a summary of what you accomplished.`,
      });

      return {
        success: true,
        task,
        summary: result.text,
        stepsUsed: result.steps.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        task,
        error: `Subagent failed: ${message}`,
      };
    }
  },
});
