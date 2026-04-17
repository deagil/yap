import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session/get-server-session";
import { AuthFlowClient } from "../auth-flow-client";

export default async function SignInPage() {
  const session = await getServerSession();
  if (session?.user) {
    if (session.user.onboardingComplete === false) {
      redirect("/onboarding");
    }
    redirect("/sessions");
  }

  return (
    <AuthFlowClient
      startAuthenticated={false}
      profileSaved={false}
      githubConnected={false}
      vercelConnected={false}
      defaultDisplayName=""
      defaultWorkspaceName=""
    />
  );
}
