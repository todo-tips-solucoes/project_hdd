"use client";

import { startFeature } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

// Story 6.10 — iniciar uma feature pelo painel (POST /api/features). A onda
// criada aparece no WaveBoard (invalida a query "waves"); a aprovação do gate
// continua na fila de gates.
export function StartFeature() {
  const [task, setTask] = useState("");
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: () => startFeature(task.trim()),
    onSuccess: () => {
      setTask("");
      qc.invalidateQueries({ queryKey: ["waves"] });
    },
  });
  const canSubmit = task.trim().length > 0 && !start.isPending;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Iniciar feature</h2>
      <textarea
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Descreva a tarefa para o agente (ex.: adicionar endpoint de health…)"
        rows={3}
        disabled={start.isPending}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) start.mutate();
        }}
        className="w-full resize-y rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {start.isError ? (
            <span className="text-danger">Falha ao iniciar — tenta de novo.</span>
          ) : start.isSuccess ? (
            <span className="text-success">
              Onda {start.data.wave_id.slice(0, 8)} enfileirada.
            </span>
          ) : (
            "⌘/Ctrl + Enter para enviar"
          )}
        </p>
        <Button disabled={!canSubmit} onClick={() => start.mutate()}>
          {start.isPending ? "Iniciando…" : "Iniciar onda"}
        </Button>
      </div>
    </Card>
  );
}
