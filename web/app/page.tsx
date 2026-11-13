import { DishaDashboard } from "@/components/disha-dashboard";
import { getDashboardSnapshot } from "@/lib/disha/store";
import { projectCashFlow } from "@/lib/engines";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getDashboardSnapshot();
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
