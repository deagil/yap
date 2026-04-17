/**
 * Server Actions that call `redirect()` throw a special error on the client.
 * Re-throw it so navigation proceeds; do not treat it as a failure.
 */
export function isNextRedirectError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
