import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./lib/supabase/types";

function wantsSharedMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) {
    return false;
  }

  const accept = acceptHeader.toLowerCase();
  return accept.includes("text/markdown") || accept.includes("text/plain");
}

/**
 * Shared page content negotiation: rewrite HTML navigations to the markdown API.
 * Used by the app proxy for GET /shared/:id when Accept prefers markdown/plain.
 */
export function maybeRewriteSharedMarkdown(
  request: NextRequest,
): NextResponse | null {
  if (request.method !== "GET") {
    return null;
  }

  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);

  if (
    segments.length === 2 &&
    segments[0] === "shared" &&
    wantsSharedMarkdown(request.headers.get("accept"))
  ) {
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = `/api/shared/${segments[1]}/markdown`;
    return NextResponse.rewrite(rewrittenUrl);
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const sharedRewrite = maybeRewriteSharedMarkdown(request);
  if (sharedRewrite) {
    return sharedRewrite;
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return response;
  }

  const supabase = createServerClient<Database>(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
