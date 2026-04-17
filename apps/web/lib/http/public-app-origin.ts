/**
 * Canonical browser origin for OAuth `redirect_uri` and absolute redirects.
 *
 * When unset, uses the inbound request URL origin (correct for direct hits to
 * the dev server). Behind reverse proxies (e.g. Portless, ngrok), set
 * `NEXT_PUBLIC_APP_URL` to the public origin (no trailing slash), e.g.
 * `https://open-harness.localhost`, so it matches the GitHub App callback URL
 * and the URL users use in the browser.
 */
export function getPublicAppOriginFromRequestUrl(requestUrl: string): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  return new URL(requestUrl).origin;
}
