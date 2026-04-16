import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { maybeRewriteSharedMarkdown } from "./proxy";

function makeRequest(path: string, accept: string, method = "GET") {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Accept: accept },
  });
}

describe("shared page content negotiation proxy", () => {
  test("rewrites markdown requests for shared pages", () => {
    const response = maybeRewriteSharedMarkdown(
      makeRequest("/shared/share-1", "text/markdown"),
    );

    expect(response).not.toBeNull();
    expect(response!.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost/api/shared/share-1/markdown",
    );
  });

  test("rewrites plain text requests for shared pages", () => {
    const response = maybeRewriteSharedMarkdown(
      makeRequest("/shared/share-1", "text/plain"),
    );

    expect(response).not.toBeNull();
    expect(response!.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost/api/shared/share-1/markdown",
    );
  });

  test("does not rewrite html page requests", () => {
    const response = maybeRewriteSharedMarkdown(
      makeRequest("/shared/share-1", "text/html"),
    );

    expect(response).toBeNull();
  });

  test("does not rewrite non-GET requests", () => {
    const response = maybeRewriteSharedMarkdown(
      makeRequest("/shared/share-1", "text/markdown", "POST"),
    );

    expect(response).toBeNull();
  });
});
