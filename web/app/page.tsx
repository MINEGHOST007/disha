import { redirect } from "next/navigation";
import { DishaDashboard } from "@/components/disha-dashboard";
import { getDashboardSnapshot } from "@/lib/disha/store";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/authz";
import { projectCashFlow } from "@/lib/engines";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const workspace = await getWorkspaceContext();
  if (!workspace) redirect("/onboarding");
  const snapshot = await getDashboardSnapshot(workspace.merchantId);
  return (
    <DishaDashboard
      initialState={snapshot.state}
      initialLogs={snapshot.logs}
      storageAvailable={snapshot.storageAvailable}
      analytics={snapshot.analytics}
      initialCashFlow={projectCashFlow(30, snapshot.state.extraBills)}
    />
  );
}
