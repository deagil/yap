import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { ThinkingState } from "../reasoning-context.js";

const SILLY_WORDS = [
  "Thinking",
  "Pondering",
  "Cogitating",
  "Ruminating",
  "Mulling",
  "Noodling",
  "Smooshing",
  "Percolating",
  "Marinating",
  "Simmering",
  "Brewing",
  "Conjuring",
  "Manifesting",
  "Vibing",
  "Channeling",
];
const SILLY_WORD_INTERVAL = 2000;

function useSillyWord() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * SILLY_WORDS.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % SILLY_WORDS.length);
    }, SILLY_WORD_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return SILLY_WORDS[index];
}

type StatusBarProps = {
  isStreaming: boolean;
  status?: string;
  thinkingState: ThinkingState;
};

function getThinkingMeta(thinkingState: ThinkingState): string {
  if (thinkingState.thinkingDuration !== null) {
    return `thought for ${thinkingState.thinkingDuration}s`;
  }
  if (thinkingState.isThinking) {
    return "thinking";
  }
  return "";
}

// Status indicator - not memoized to allow animation
function StatusIndicator({
  isStreaming,
  status,
  thinkingState,
}: {
  isStreaming: boolean;
  status?: string;
  thinkingState: ThinkingState;
}) {
  const sillyWord = useSillyWord();
  const isDefaultStatus = !status || status === "Thinking...";
  const displayStatus = isDefaultStatus ? `${sillyWord}...` : status;

  // Determine prefix: + while streaming/thinking not done, * when thinking completed
  const hasThinkingCompleted = thinkingState.thinkingDuration !== null;
  const prefix = hasThinkingCompleted ? "*" : "+";

  // Build the meta text
  const thinkingMeta = getThinkingMeta(thinkingState);
  const metaText = thinkingMeta
    ? `(esc to interrupt · ${thinkingMeta})`
    : "(esc to interrupt)";

  if (isStreaming) {
    return (
      <>
        <Text color="yellow">{prefix} </Text>
        <Text color="yellow">{displayStatus}</Text>
        <Text color="gray"> {metaText}</Text>
      </>
    );
  }
  return <Text color="green">✓ {status || "Done"}</Text>;
}

// Not memoized to allow animation
export function StatusBar({
  isStreaming,
  status,
  thinkingState,
}: StatusBarProps) {
  if (!isStreaming && !status) {
    return null;
  }

  return (
    <Box marginTop={1}>
      <StatusIndicator
        isStreaming={isStreaming}
        status={status}
        thinkingState={thinkingState}
      />
    </Box>
  );
}
