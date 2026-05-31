"use client";

import { AppShell } from "@/components/AppShell";
import { GateDetail } from "@/components/GateDetail";
import { useParams } from "next/navigation";

export default function GateDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <AppShell>
      <GateDetail id={params.id} />
    </AppShell>
  );
}
