import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session/get-server-session";
import { HomePage } from "./home-page";

export default async function Home() {
  const session = await getServerSession();
  if (session?.user) {
    if (session.user.onboardingComplete === false) {
      redirect("/onboarding");
    }
    redirect("/sessions");
  }

  return <HomePage lastRepo={null} />;
}
