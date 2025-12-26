import { tool } from "ai";
import { z } from "zod";
import { searchMemory, getRecentMemories } from "../../state/memory-store";

export const memoryRecallTool = tool({
  description: `Retrieve information from long-term memory.

WHEN TO USE:
- Starting a new conversation in a familiar project
- Looking for previously learned patterns or solutions
- Recalling user preferences or conventions
- Finding context from past interactions

You can search by text query, filter by tags, or get recent memories.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Text to search for in memory content"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Filter by tags (matches if any tag matches)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of results. Default: 10"),
  }),
  execute: async ({ query, tags, limit = 10 }, { experimental_context }) => {
    try {
      const context = experimental_context as { workingDirectory?: string } | undefined;
      const workingDirectory = context?.workingDirectory ?? process.cwd();

      let entries;

      if (query || (tags && tags.length > 0)) {
        entries = await searchMemory(workingDirectory, query ?? "", tags);
        entries = entries.slice(0, limit);
      } else {
        entries = await getRecentMemories(workingDirectory, limit);
      }

      if (entries.length === 0) {
        return {
          success: true,
          message: "No memories found matching the criteria",
          memories: [],
        };
      }

      return {
        success: true,
        count: entries.length,
        memories: entries.map((e) => ({
          id: e.id,
          content: e.content,
          tags: e.tags,
          createdAt: new Date(e.createdAt).toISOString(),
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to recall memory: ${message}`,
      };
    }
  },
});
