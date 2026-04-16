import { Suspense } from "react";
import { SignInClient } from "./sign-in-client";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Loading…
        </div>
      }
    >
      <SignInClient />
    </Suspense>
  );
}
