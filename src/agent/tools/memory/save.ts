import { tool } from "ai";
import { z } from "zod";
import { addMemoryEntry } from "../../state/memory-store";

export const memorySaveTool = tool({
  description: `Save information to long-term memory for recall in future conversations.

WHEN TO USE:
- Important facts learned during research
- User preferences or project conventions discovered
- Key decisions made during the conversation
- Patterns or solutions that may be useful later

IMPORTANT:
- Include relevant tags for easier retrieval
- Keep content concise but complete
- Include context about when/why this is useful`,
  inputSchema: z.object({
    content: z.string().describe("The information to remember"),
    tags: z
      .array(z.string())
      .describe("Tags for categorization and retrieval (e.g., ['auth', 'security', 'pattern'])"),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional structured metadata"),
  }),
  execute: async ({ content, tags, metadata }, { experimental_context }) => {
    try {
      const context = experimental_context as { workingDirectory?: string } | undefined;
      const workingDirectory = context?.workingDirectory ?? process.cwd();

      const entry = await addMemoryEntry(workingDirectory, {
        content,
        tags,
        metadata,
      });

      return {
        success: true,
        id: entry.id,
        message: `Saved to memory with tags: ${tags.join(", ")}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to save memory: ${message}`,
      };
    }
  },
});
