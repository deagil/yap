"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

export function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const next = resolveNext(searchParams);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Missing email. Start from sign-in.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: "email",
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Verification failed",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <p className="text-muted-foreground">
          <Link href="/sign-in" className="text-primary underline">
            Start sign-in
          </Link>{" "}
          to receive a code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Enter code</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <form className="space-y-3" onSubmit={verify}>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={token}
            onChange={(ev) => setToken(ev.target.value)}
            maxLength={10}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Verify"}
          </Button>
        </form>

        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="underline underline-offset-4">
            Use a different email
          </Link>
        </p>
      </div>
    </div>
  );
}
