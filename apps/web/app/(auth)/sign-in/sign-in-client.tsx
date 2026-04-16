"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function resolveNext(searchParams: ReturnType<typeof useSearchParams>): string {
  const raw = searchParams.get("next");
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/sessions";
}

export function SignInClient() {
  const searchParams = useSearchParams();
  const next = resolveNext(searchParams);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const origin = window.location.origin;
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      window.location.assign(
        `/verify?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(next)}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithSlack() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const origin = window.location.origin;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "slack_oidc",
        options: {
          redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
          scopes: "openid email profile",
        },
      });
      if (err) {
        setError(err.message);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use email (one-time code) or Slack.
          </p>
        </div>

        <form className="space-y-3" onSubmit={sendOtp}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email.trim()}
          >
            {loading ? <Loader2 className="animate-spin" /> : "Email me a code"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={loading}
          onClick={() => {
            void signInWithSlack();
          }}
        >
          Continue with Slack
        </Button>

        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="underline underline-offset-4">
            Back home
          </Link>
        </p>
      </div>
    </div>
  );
}
