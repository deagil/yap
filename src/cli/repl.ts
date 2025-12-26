import * as readline from "readline";
import type { DeepAgent } from "../agent";

export interface ReplOptions {
  agent: DeepAgent;
  prompt?: string;
}

export async function startRepl(options: ReplOptions): Promise<void> {
  const { agent, prompt: promptPrefix = ">" } = options;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Deep Agent REPL");
  console.log("Type 'exit' or 'quit' to exit, 'clear' to reset state");
  console.log("");

  const askQuestion = (): void => {
    rl.question(`${promptPrefix} `, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed === "exit" || trimmed === "quit") {
        console.log("Goodbye!");
        rl.close();
        return;
      }

      if (trimmed === "clear") {
        agent.resetState();
        console.log("State cleared.\n");
        askQuestion();
        return;
      }

      if (trimmed === "state") {
        const state = agent.getState();
        console.log("\nCurrent State:");
        console.log(`  Todos: ${state.todos.length}`);
        console.log(`  Scratchpad entries: ${state.scratchpad.size}`);
        console.log("");
        askQuestion();
        return;
      }

      try {
        const stream = await agent.agent.stream({ prompt: trimmed, options: {} });

        for await (const chunk of stream.textStream) {
          process.stdout.write(chunk);
        }

        console.log("\n");
      } catch (error) {
        console.error(
          "\nError:",
          error instanceof Error ? error.message : error
        );
        console.log("");
      }

      askQuestion();
    });
  };

  askQuestion();
}
