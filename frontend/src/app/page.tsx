import { AppShell } from "@/components/AppShell";
import { EventFeed } from "@/components/EventFeed";
import { StartFeature } from "@/components/StartFeature";
import { WaveBoard } from "@/components/WaveBoard";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <StartFeature />
          <WaveBoard />
        </div>
        <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
          <EventFeed />
        </div>
      </div>
    </AppShell>
  );
}
