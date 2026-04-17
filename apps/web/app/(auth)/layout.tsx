import type { ReactNode } from "react";

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return <div className="h-svh overflow-hidden bg-background">{children}</div>;
}
