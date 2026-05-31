import { AppShell } from "@/components/AppShell";
import { EventFeed } from "@/components/EventFeed";
import { WaveBoard } from "@/components/WaveBoard";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <WaveBoard />
        <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
          <EventFeed />
        </div>
      </div>
    </AppShell>
  );
}
