"use client";

// Feed ao vivo dos eventos de auditoria (SSE). Externaliza o acompanhamento:
// narrativa > logs crus. Reconecta automaticamente (EventSource nativo).
import { eventStreamUrl, type AuditEvent } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card } from "./ui/card";

const LABEL: Record<string, string> = {
  "session.created": "Sessão criada",
  "session.resumed": "Sessão retomada",
  "wave.started": "Onda iniciada",
  "wave.verified": "Onda verificada",
  "wave.merged": "Onda integrada",
  "gate.requested": "Gate solicitado",
  "gate.approved": "Gate aprovado",
  "gate.rejected": "Gate rejeitado",
  "error.raised": "Erro",
};

export function EventFeed() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const es = new EventSource(eventStreamUrl(), { withCredentials: true });
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("audit", (e) => {
      const ev = JSON.parse((e as MessageEvent).data) as AuditEvent;
      setEvents((prev) => [ev, ...prev].slice(0, 50));
    });
    return () => es.close();
  }, []);

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Atividade ao vivo</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className={`h-2 w-2 rounded-full ${live ? "bg-success" : "bg-muted"}`}
          />
          {live ? "conectado" : "off"}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm text-muted">Aguardando eventos…</p>
        ) : null}
        <AnimatePresence initial={false}>
          {events.map((ev) => (
            <motion.div
              key={ev.event_id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-baseline justify-between rounded-md bg-surface-2 px-3 py-1.5 text-sm"
            >
              <span>
                {LABEL[ev.type] ?? ev.type}{" "}
                <span className="text-muted">· {ev.actor}</span>
              </span>
              <span className="font-mono text-xs text-muted">
                {new Date(ev.occurred_at).toLocaleTimeString("pt-BR")}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
