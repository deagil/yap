"use client";

import { Button } from "@/components/ui/button";
import type { QuestionConfig } from "./survey-types";

interface ConnectQuestionProps<A extends Record<string, unknown>> {
  question: QuestionConfig<A>;
  onAdvance: (value: unknown) => void;
  disabled?: boolean;
}

export function ConnectQuestion<A extends Record<string, unknown>>({
  question,
  onAdvance,
  disabled = false,
}: ConnectQuestionProps<A>) {
  const cfg = question.connect;
  if (!cfg) return null;

  const required = cfg.required === true;
  const comingSoon = cfg.comingSoon === true;

  return (
    <div className="flex w-full flex-col gap-3">
      {comingSoon ? (
        <>
          <Button
            type="button"
            variant="default"
            className="w-full"
            size="lg"
            disabled
          >
            {cfg.label}
          </Button>
          {cfg.note ? (
            <p className="text-sm text-muted-foreground">{cfg.note}</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            disabled={disabled}
            onClick={() => {
              onAdvance("skipped");
            }}
          >
            Continue
          </Button>
        </>
      ) : (
        <>
          <Button asChild className="w-full" size="lg">
            {/* Use <a> not next/link — install/OAuth URLs must be full navigations, not RSC prefetch. */}
            <a href={cfg.href}>{cfg.label}</a>
          </Button>
          {cfg.note ? (
            <p className="text-sm text-muted-foreground">{cfg.note}</p>
          ) : null}
          {!required ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={disabled}
              onClick={() => {
                onAdvance("skipped");
              }}
            >
              Skip for now
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
