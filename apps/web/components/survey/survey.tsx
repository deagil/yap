"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { SurveyShell, SurveyQuestion } from "./survey-shell";
import { QuestionRenderer } from "./question-renderer";
import { useCurrentQuestion } from "@/hooks/use-current-question";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isNextRedirectError } from "@/lib/navigation/is-next-redirect-error";
import type { QuestionConfig } from "./survey-types";

export type BeforeAdvanceResult =
  | { ok: true; patch?: Record<string, unknown> }
  | { ok: false; error: string };

export interface SurveyProps<A extends Record<string, unknown>> {
  questions: QuestionConfig<A>[];
  attributes: A;
  onAttributeChange: (attributes: A) => void;
  onComplete: (attributes: A) => void;
  /** Custom right panel content. Overrides `rightImage`. */
  rightContent?: React.ReactNode;
  /** Shorthand: provide an image URL and it fills the right panel as cover. */
  rightImage?: string;
  /** Hide the right panel and center the survey content. */
  hideRightPanel?: boolean;
  /** Logo image URL for top-left branding. Max height 32px. */
  logoUrl?: string;
  /** Custom logo element (overrides `logoUrl`). */
  logo?: React.ReactNode;
  onBackFromFirstQuestion?: () => void;
  hideContinueButton?: boolean;
  hideQuestionTitle?: boolean;
  showProgress?: boolean;
  className?: string;
  /** First question to focus on mount (defaults to first in filtered list). */
  initialQuestionId?: string;
  /** Fires whenever the active question changes. */
  onQuestionChange?: (questionId: string | null) => void;
  /**
   * Runs after local validation, before advancing. Return `{ ok: false }` to
   * block advancement and surface an error (e.g. async auth calls).
   */
  onBeforeAdvance?: (context: {
    question: QuestionConfig<A>;
    value: unknown;
    attributes: A;
  }) => Promise<BeforeAdvanceResult> | BeforeAdvanceResult;
  /** Extra content rendered below the active question (e.g. alternative actions). */
  questionFooter?: (question: QuestionConfig<A>) => React.ReactNode;
}

export function Survey<A extends Record<string, unknown>>({
  questions,
  attributes,
  onAttributeChange,
  onComplete,
  rightContent,
  rightImage,
  hideRightPanel = false,
  logoUrl,
  logo,
  onBackFromFirstQuestion,
  hideContinueButton = false,
  hideQuestionTitle = false,
  showProgress = false,
  className,
  initialQuestionId,
  onQuestionChange,
  onBeforeAdvance,
  questionFooter,
}: SurveyProps<A>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tempAnswer, setTempAnswer] = useState<unknown>(null);
  const [validationError, setValidationError] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const {
    filteredQuestions,
    currentQuestion,
    currentQuestionIndex,
    setActiveQuestionId,
    totalQuestions,
  } = useCurrentQuestion(questions, attributes, initialQuestionId);

  useEffect(() => {
    onQuestionChange?.(currentQuestion ? String(currentQuestion.id) : null);
  }, [currentQuestion, onQuestionChange]);

  useEffect(() => {
    if (currentQuestion) {
      const existing = (attributes as Record<string, unknown>)[
        currentQuestion.id
      ];
      if (currentQuestion.type === "info") {
        setTempAnswer(true);
      } else if (currentQuestion.type === "slider" && existing === undefined) {
        const sp = currentQuestion.sliderProps;
        const min = sp?.min ?? 0;
        const max = sp?.max ?? 10;
        setTempAnswer(Math.round((min + max) / 2));
      } else {
        setTempAnswer(existing);
      }
      setValidationError("");
    }
  }, [currentQuestion, attributes]);

  const validateAnswer = (answer: unknown): boolean => {
    if (!currentQuestion?.validationSchema) return true;
    try {
      currentQuestion.validationSchema.parse(answer);
      setValidationError("");
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setValidationError(
          currentQuestion.validationErrorMessage ??
            err.issues[0]?.message ??
            "Invalid input",
        );
      }
      return false;
    }
  };

  const goToNext = async (overrideAnswer?: unknown) => {
    if (advancing) return;
    const answer = overrideAnswer !== undefined ? overrideAnswer : tempAnswer;
    if (!validateAnswer(answer)) return;

    let patch: Record<string, unknown> | undefined;

    if (currentQuestion && onBeforeAdvance) {
      setAdvancing(true);
      try {
        const result = await onBeforeAdvance({
          question: currentQuestion,
          value: answer,
          attributes,
        });
        if (!result.ok) {
          setValidationError(result.error);
          return;
        }
        patch = result.patch;
      } catch (err) {
        if (isNextRedirectError(err)) {
          throw err;
        }
        setValidationError(
          err instanceof Error ? err.message : "Something went wrong",
        );
        return;
      } finally {
        setAdvancing(false);
      }
    }

    if (currentQuestion) {
      const merged = {
        ...attributes,
        [currentQuestion.id]: answer,
        ...patch,
      };
      onAttributeChange(merged);
      setTempAnswer(answer);

      if (
        currentQuestionIndex !== -1 &&
        currentQuestionIndex < filteredQuestions.length - 1
      ) {
        const nextQ = filteredQuestions[currentQuestionIndex + 1];
        if (nextQ) setActiveQuestionId(String(nextQ.id));
      } else {
        onComplete(merged);
      }
    } else if (patch) {
      onAttributeChange({ ...attributes, ...patch });
    }
  };

  const goToPrevious = () => {
    setValidationError("");
    if (currentQuestionIndex === 0 && onBackFromFirstQuestion) {
      onBackFromFirstQuestion();
    } else if (currentQuestionIndex > 0) {
      const prevQ = filteredQuestions[currentQuestionIndex - 1];
      if (prevQ) setActiveQuestionId(String(prevQ.id));
    }
  };

  // Resolve right panel: hidden > explicit content > image shorthand > default gradient
  const resolvedRightContent = hideRightPanel
    ? undefined
    : (rightContent ??
      (rightImage ? (
        <div className="relative h-full w-full overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic URL from survey config */}
          <img src={rightImage} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/5" />
        </div>
      ) : (
        <div className="relative h-full w-full overflow-hidden rounded-2xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
          <img
            src="/placeholder.svg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover dark:invert"
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/5" />
        </div>
      )));

  if (!currentQuestion) return null;

  const showBack =
    !advancing && (currentQuestionIndex > 0 || !!onBackFromFirstQuestion);
  const showNext =
    !hideContinueButton &&
    currentQuestion.type !== "connect" &&
    (currentQuestion.type === "info" || !!tempAnswer);
  const progressPercent =
    currentQuestionIndex >= 0 && totalQuestions
      ? ((currentQuestionIndex + 1) / totalQuestions) * 100
      : 0;

  return (
    <SurveyShell
      className={className}
      rightContent={resolvedRightContent}
      logo={logo}
      logoUrl={logoUrl}
      showProgress={showProgress}
      progressPercent={progressPercent}
      actions={
        <div className="mx-auto w-full max-w-lg">
          {/* Desktop */}
          <div className="hidden items-center justify-between md:flex">
            <Button
              variant="outline"
              size="icon"
              className={cn("min-h-10 min-w-10", showBack ? "" : "invisible")}
              onClick={goToPrevious}
              aria-label="Go back"
              disabled={advancing}
            >
              <ArrowLeft />
            </Button>
            <Button
              size="lg"
              onClick={() => {
                void goToNext();
              }}
              disabled={advancing}
              className={showNext ? "" : "invisible"}
            >
              {advancing ? <Loader2 className="animate-spin" /> : "Continue"}
            </Button>
          </div>
          {/* Mobile */}
          {!hideContinueButton && (
            <div className="flex gap-3 md:hidden">
              {showBack && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={goToPrevious}
                  aria-label="Go back"
                  disabled={advancing}
                >
                  <ArrowLeft />
                  Back
                </Button>
              )}
              <Button
                size="lg"
                className="flex-1"
                onClick={() => {
                  void goToNext();
                }}
                disabled={!showNext || advancing}
              >
                {advancing ? <Loader2 className="animate-spin" /> : "Continue"}
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div ref={containerRef} className="mx-auto w-full max-w-lg py-6">
        {/* Question — fade + subtle slide on transition */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
          >
            <SurveyQuestion
              title={currentQuestion.title}
              description={currentQuestion.description}
              active
              hideQuestionTitle={hideQuestionTitle}
            >
              <QuestionRenderer
                question={currentQuestion}
                attributes={attributes}
                isActive
                onEnter={() => {
                  void goToNext();
                }}
                advanceWithValue={(value) => {
                  void goToNext(value);
                }}
                onChange={(value: unknown) => {
                  setTempAnswer(value);
                  setValidationError("");
                }}
                value={tempAnswer}
              />
              {validationError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
              {questionFooter ? (
                <div className="mt-6">{questionFooter(currentQuestion)}</div>
              ) : null}
            </SurveyQuestion>
          </motion.div>
        </AnimatePresence>
      </div>
    </SurveyShell>
  );
}
