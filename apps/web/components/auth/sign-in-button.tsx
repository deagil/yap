"use client";

import Link from "next/link";
import { type ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type SignInButtonProps = {
  callbackUrl?: string;
} & Omit<ComponentProps<typeof Button>, "href">;

export function SignInButton({
  callbackUrl,
  children = "Sign in",
  ...props
}: SignInButtonProps) {
  const href = callbackUrl
    ? `/sign-in?next=${encodeURIComponent(callbackUrl)}`
    : "/sign-in";

  return (
    <Button asChild {...props}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
