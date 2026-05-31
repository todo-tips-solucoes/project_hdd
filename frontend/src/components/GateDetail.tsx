"use client";

import { approveGate, getGate, rejectGate } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function GateDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["gate", id],
    queryFn: () => getGate(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["gate", id] });
    qc.invalidateQueries({ queryKey: ["gates"] });
    qc.invalidateQueries({ queryKey: ["waves"] });
  };
  const approve = useMutation({ mutationFn: () => approveGate(id), onSuccess: invalidate });
  const reject = useMutation({ mutationFn: () => rejectGate(id), onSuccess: invalidate });
  const busy = approve.isPending || reject.isPending;

  if (isLoading) return <Card className="text-muted">Carregando gate…</Card>;
  if (isError || !data)
    return <Card className="text-danger">Gate não encontrado.</Card>;

  const pending = data.status.toLowerCase() === "pending";

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/gates" className="text-sm text-muted hover:text-foreground">
        ← Gates
      </Link>
      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <Badge value={data.gate_type} />
          <Badge value={data.status} />
        </div>
        <h1 className="mt-3 text-lg font-semibold">{data.reason}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Onda</dt>
          <dd className="font-mono">{data.wave_id}</dd>
          {data.expires_at ? (
            <>
              <dt className="text-muted">Expira</dt>
              <dd>{new Date(data.expires_at).toLocaleString("pt-BR")}</dd>
            </>
          ) : null}
        </dl>

        {pending ? (
          <div className="mt-6 flex gap-3">
            <Button variant="success" disabled={busy} onClick={() => approve.mutate()}>
              Aprovar
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => reject.mutate()}>
              Rejeitar
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Este gate já foi resolvido — nenhuma ação disponível.
          </p>
        )}
      </Card>
    </div>
  );
}
