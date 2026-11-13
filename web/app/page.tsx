import { DishaDashboard } from "@/components/disha-dashboard";
import { getDashboardSnapshot } from "@/lib/disha/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getDashboardSnapshot();
  return (
    <DishaDashboard
      initialState={snapshot.state}
      initialLogs={snapshot.logs}
      storageAvailable={snapshot.storageAvailable}
      analytics={snapshot.analytics}
    />
  );
}
