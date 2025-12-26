#!/usr/bin/env node

import { createDeepAgent } from "../agent";

async function main() {
  const args = process.argv.slice(2);
  const workingDirectory = process.cwd();

  console.log("Deep Agent CLI");
  console.log("==============");
  console.log(`Working directory: ${workingDirectory}`);
  console.log("");

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  deep-agent <prompt>     Run a one-shot prompt");
    console.log("  deep-agent --repl       Start interactive REPL (coming soon)");
    console.log("");
    console.log("Examples:");
    console.log('  deep-agent "Explain the structure of this codebase"');
    console.log('  deep-agent "Add a new endpoint to handle user authentication"');
    process.exit(0);
  }

  if (args[0] === "--repl") {
    console.log("Interactive REPL mode coming soon...");
    console.log("For now, use one-shot mode with a prompt.");
    process.exit(0);
  }

  const prompt = args.join(" ");
  console.log(`Prompt: ${prompt}`);
  console.log("");

  const { agent } = createDeepAgent({ workingDirectory });

  try {
    console.log("Running agent...\n");

    const stream = await agent.stream({ prompt, options: {} });

    for await (const chunk of stream.textStream) {
      process.stdout.write(chunk);
    }

    console.log("\n\nDone.");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
