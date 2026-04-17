"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Survey, type BeforeAdvanceResult } from "@/components/survey/survey";
import type { QuestionConfig } from "@/components/survey/survey-types";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  completeOnboarding,
  saveOnboardingProfile,
} from "./onboarding/actions";

interface AuthFlowAttrs extends Record<string, unknown> {
  email?: string;
  otp?: string;
  displayName?: string;
  workspaceName?: string;
  _authenticated?: boolean;
  profileSaved?: boolean;
  githubConnected?: boolean;
  vercelConnected?: boolean;
  connectGithub?: string;
  connectVercel?: string;
  connectSlack?: string;
}

function buildQuestions(): QuestionConfig<AuthFlowAttrs>[] {
  return [
    {
      id: "email",
      title: "What's your email?",
      description:
        "We'll send a one-time code so you can sign in without a password.",
      type: "text",
      placeholder: "you@company.com",
      inputProps: {
        type: "email",
        inputMode: "email",
        autoComplete: "email",
      },
      validationSchema: z.string().email("Enter a valid email"),
      validationErrorMessage: "Enter a valid email",
      condition: (attrs) => attrs._authenticated !== true,
    },
    {
      id: "otp",
      title: "Enter your code",
      description: "Check your inbox for a 6-digit code.",
      type: "text",
      placeholder: "123456",
      inputProps: {
        inputMode: "numeric",
        autoComplete: "one-time-code",
        maxLength: 10,
        pattern: "[0-9]*",
      },
      validationSchema: z.string().trim().min(4, "Enter the code"),
      validationErrorMessage: "Enter the code",
      condition: (attrs) => attrs._authenticated !== true,
    },
    {
      id: "displayName",
      title: "What's your name?",
      description: "This is how teammates will see you.",
      type: "text",
      placeholder: "Jane Doe",
      inputProps: { autoComplete: "name" },
      validationSchema: z.string().trim().min(1, "Name is required"),
      validationErrorMessage: "Name is required",
      condition: (attrs) => attrs.profileSaved !== true,
    },
    {
      id: "workspaceName",
      title: "Name your workspace",
      description: "You can change this anytime in settings.",
      type: "text",
      placeholder: "Acme Inc",
      inputProps: { autoComplete: "organization" },
      validationSchema: z.string().trim().min(1, "Workspace name is required"),
      validationErrorMessage: "Workspace name is required",
      condition: (attrs) => attrs.profileSaved !== true,
    },
    {
      id: "connectGithub",
      title: "Connect your GitHub",
      description:
        "Install the GitHub App on the org or account whose repos the agent should use.",
      type: "connect",
      connect: {
        label: "Install GitHub App",
        href: "/api/github/app/install?next=/onboarding",
        required: true,
      },
      condition: (attrs) => attrs.githubConnected !== true,
    },
    {
      id: "connectVercel",
      title: "Connect Vercel (optional)",
      description:
        "Link Vercel so preview URLs can show up when the agent pushes a branch.",
      type: "connect",
      connect: {
        label: "Connect Vercel",
        href: "/api/integrations/vercel/start?next=/onboarding",
      },
      condition: (attrs) =>
        attrs.vercelConnected !== true && attrs.connectVercel !== "skipped",
    },
    {
      id: "connectSlack",
      title: "Slack",
      description:
        "Chat-driven coding via Slack is coming soon. You can continue — install from Settings later.",
      type: "connect",
      connect: {
        label: "Install Slack app",
        href: "#",
        comingSoon: true,
      },
      condition: (attrs) => attrs.connectSlack !== "skipped",
    },
  ];
}

const questions = buildQuestions();

interface AuthFlowClientProps {
  startAuthenticated: boolean;
  profileSaved: boolean;
  githubConnected: boolean;
  vercelConnected: boolean;
  defaultDisplayName: string;
  defaultWorkspaceName: string;
}

export function AuthFlowClient({
  startAuthenticated,
  profileSaved: profileSavedProp,
  githubConnected: githubConnectedProp,
  vercelConnected: vercelConnectedProp,
  defaultDisplayName,
  defaultWorkspaceName,
}: AuthFlowClientProps) {
  const router = useRouter();
  const [attrs, setAttrs] = useState<AuthFlowAttrs>({
    _authenticated: startAuthenticated,
    profileSaved: profileSavedProp,
    githubConnected: githubConnectedProp,
    vercelConnected: vercelConnectedProp,
    displayName: defaultDisplayName,
    workspaceName: defaultWorkspaceName,
  });
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(
    null,
  );

  async function handleBeforeAdvance({
    question,
    value,
    attributes,
  }: {
    question: QuestionConfig<AuthFlowAttrs>;
    value: unknown;
    attributes: AuthFlowAttrs;
  }): Promise<BeforeAdvanceResult> {
    const supabase = createBrowserSupabase();

    if (question.id === "email") {
      const email = String(value ?? "").trim();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/api/auth/callback`,
        },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    if (question.id === "otp") {
      const email = String(attributes.email ?? "").trim();
      const token = String(value ?? "").trim();
      if (!email) {
        return {
          ok: false,
          error: "Missing email. Go back and try again.",
        };
      }
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (verifyError) return { ok: false, error: verifyError.message };

      const ensureRes = await fetch("/api/auth/ensure-workspace", {
        method: "POST",
      });
      if (!ensureRes.ok) {
        const body = (await ensureRes.json().catch(() => ({}))) as {
          error?: string;
        };
        return {
          ok: false,
          error: body.error ?? "Could not set up your workspace.",
        };
      }

      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/onboarding");
      }

      return { ok: true, patch: { _authenticated: true } };
    }

    if (question.id === "workspaceName") {
      const result = await saveOnboardingProfile({
        displayName: String(attributes.displayName ?? ""),
        workspaceName: String(value ?? ""),
      });
      if (result?.error) {
        return { ok: false, error: result.error };
      }
      return { ok: true, patch: { profileSaved: true } };
    }

    if (question.id === "connectSlack") {
      const result = await completeOnboarding();
      if (result?.error) {
        return { ok: false, error: result.error };
      }
      return { ok: true };
    }

    return { ok: true };
  }

  async function signInWithSlack(): Promise<void> {
    setSlackError(null);
    setSlackLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "slack_oidc",
        options: {
          redirectTo: `${origin}/api/auth/callback`,
          scopes: "openid email profile",
        },
      });
      if (error) throw error;
    } catch (err) {
      setSlackLoading(false);
      setSlackError(
        err instanceof Error ? err.message : "Could not start Slack sign-in.",
      );
    }
  }

  return (
    <Survey
      questions={questions}
      attributes={attrs}
      onAttributeChange={setAttrs}
      onBeforeAdvance={handleBeforeAdvance}
      onQuestionChange={setCurrentQuestionId}
      onComplete={() => {
        /* Final step completes inside onBeforeAdvance (connectSlack). */
      }}
      onBackFromFirstQuestion={() => {
        router.replace("/");
      }}
      showProgress
      hideRightPanel
      logo={
        <span className="font-heading text-lg font-semibold tracking-tight">
          Open Agents
        </span>
      }
      questionFooter={(question) => {
        if (question.id !== "email" || currentQuestionId !== "email") {
          return null;
        }
        return (
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              size="lg"
              disabled={slackLoading}
              onClick={() => {
                void signInWithSlack();
              }}
            >
              Continue with Slack
            </Button>
            {slackError ? (
              <p className="text-center text-sm text-destructive">
                {slackError}
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}
