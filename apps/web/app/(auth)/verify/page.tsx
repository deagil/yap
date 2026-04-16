import { Suspense } from "react";
import { VerifyClient } from "./verify-client";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Loading…
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}
