"use client";

import { getWaves, type SessionOut } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

export function WaveBoard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["waves"],
    queryFn: getWaves,
    refetchInterval: 4_000,
  });

  if (isLoading) return <Card className="text-muted">Carregando ondas…</Card>;
  if (isError || !data)
    return <Card className="text-danger">Falha ao carregar ondas.</Card>;

  const bySession = new Map<string, SessionOut>(
    data.sessions.map((s) => [s.id, s]),
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Ondas</h2>
      {data.waves.length === 0 ? (
        <Card className="text-muted">Nenhuma onda ainda.</Card>
      ) : null}
      {data.waves.map((w, i) => {
        const session = bySession.get(w.session_id);
        return (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {session?.task ?? "(sessão desconhecida)"}
                </p>
                <p className="font-mono text-xs text-muted">
                  onda {w.id.slice(0, 8)} · {w.n_corrections} correções
                </p>
              </div>
              <Badge value={w.state} />
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
