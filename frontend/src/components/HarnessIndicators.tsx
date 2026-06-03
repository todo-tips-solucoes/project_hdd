"use client";

import { getHarness } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

// Indicadores do harness de dogfood (Story 7.17) — read-model de GET /api/harness.
export function HarnessIndicators() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["harness"],
    queryFn: getHarness,
    refetchInterval: 4_000,
  });

  if (isLoading)
    return <Card className="text-muted">Carregando indicadores…</Card>;
  if (isError || !data)
    return <Card className="text-danger">Falha ao carregar indicadores.</Card>;

  const ativos = Object.entries(data.by_state).filter(([, n]) => n > 0);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">Indicadores do harness</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Ondas" value={data.total_waves} />
        <Stat label="No gate" value={data.reached_gate} />
        <Stat label="Escaladas" value={data.escalated} />
        <Stat label="Falhas" value={data.failed} />
        <Stat label="Correções (total)" value={data.total_corrections} />
        <Stat label="Correções (média)" value={data.mean_corrections.toFixed(2)} />
        <Stat label="Gates pendentes" value={data.gates_pending} />
      </div>
      {ativos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {ativos.map(([state, n]) => (
            <span key={state} className="inline-flex items-center gap-1">
              <Badge value={state} />
              <span className="text-xs text-muted tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
