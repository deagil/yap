import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

export const readFileTool = tool({
  description: `Read a file from the filesystem or scratchpad.

USAGE:
- The path must be an absolute path for filesystem, or start with /scratchpad/ for scratchpad
- By default reads up to 2000 lines from the beginning
- Use offset and limit for long files
- Results include line numbers starting at 1

IMPORTANT:
- Always read a file before editing it
- You can call multiple Read tools in parallel to speculatively read multiple files
- For directories, use the glob or bash ls command instead`,
  inputSchema: z.object({
    filePath: z.string().describe("Absolute path to the file to read"),
    offset: z
      .number()
      .optional()
      .describe("Line number to start reading from (1-indexed)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of lines to read. Default: 2000"),
  }),
  execute: async ({ filePath, offset = 1, limit = 2000 }) => {
    try {
      if (filePath.startsWith("/scratchpad/")) {
        return {
          success: false,
          error: "Scratchpad reads are handled via agent state injection",
          hint: "The scratchpad content is available in the system context",
        };
      }

      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(filePath);

      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        return {
          success: false,
          error: "Cannot read a directory. Use glob or ls command instead.",
        };
      }

      const content = await fs.readFile(absolutePath, "utf-8");
      const lines = content.split("\n");
      const startLine = Math.max(1, offset) - 1;
      const endLine = Math.min(lines.length, startLine + limit);
      const selectedLines = lines.slice(startLine, endLine);

      const numberedLines = selectedLines.map(
        (line, i) => `${startLine + i + 1}: ${line}`
      );

      return {
        success: true,
        path: absolutePath,
        totalLines: lines.length,
        startLine: startLine + 1,
        endLine,
        content: numberedLines.join("\n"),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to read file: ${message}`,
      };
    }
  },
});
