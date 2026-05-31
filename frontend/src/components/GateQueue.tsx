"use client";

import { approveGate, getGates, rejectGate, type GateOut } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

function GateRow({ gate }: { gate: GateOut }) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["gates"] });
    qc.invalidateQueries({ queryKey: ["waves"] });
  };
  const approve = useMutation({ mutationFn: () => approveGate(gate.id), onSuccess: refresh });
  const reject = useMutation({ mutationFn: () => rejectGate(gate.id), onSuccess: refresh });
  const busy = approve.isPending || reject.isPending;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <Card className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge value={gate.gate_type} />
          </div>
          <Link href={`/gates/${gate.id}`} className="mt-1 block truncate text-sm hover:underline">
            {gate.reason}
          </Link>
          <p className="font-mono text-xs text-muted">onda {gate.wave_id.slice(0, 8)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="success" disabled={busy} onClick={() => approve.mutate()}>
            Aprovar
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => reject.mutate()}>
            Rejeitar
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

export function GateQueue() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["gates"],
    queryFn: getGates,
    refetchInterval: 4_000,
  });

  if (isLoading) return <Card className="text-muted">Carregando gates…</Card>;
  if (isError || !data)
    return <Card className="text-danger">Falha ao carregar gates.</Card>;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Gates pendentes ({data.length})</h2>
      {data.length === 0 ? (
        <Card className="text-muted">Nenhum gate pendente. ✨</Card>
      ) : null}
      <AnimatePresence initial={false}>
        {data.map((g) => (
          <GateRow key={g.id} gate={g} />
        ))}
      </AnimatePresence>
    </div>
  );
}
