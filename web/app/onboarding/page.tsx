import { redirect } from "next/navigation";
import { WorkspaceOnboardingForm } from "@/components/workspace-onboarding-form";
import { getWorkspaceContext } from "@/lib/supabase/authz";
import { createClient } from "@/lib/supabase/server";
import "./onboarding.css";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  if (await getWorkspaceContext()) redirect("/");
  return <WorkspaceOnboardingForm />;
}
