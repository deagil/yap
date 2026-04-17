import type { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE_NAME } from "./constants";

export function setActiveWorkspaceCookie(
  response: NextResponse,
  workspaceId: string,
): void {
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
  });
}
