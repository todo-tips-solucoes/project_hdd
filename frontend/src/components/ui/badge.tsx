import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

// Cores por estado de onda/gate — leitura rápida no painel.
const tone: Record<string, string> = {
  planned: "bg-surface-2 text-muted",
  executing: "bg-primary/20 text-primary",
  verifying: "bg-warning/20 text-warning",
  correcting: "bg-warning/20 text-warning",
  awaiting_gate: "bg-warning/25 text-warning",
  merged: "bg-success/20 text-success",
  escalated: "bg-danger/20 text-danger",
  failed: "bg-danger/20 text-danger",
  pending: "bg-warning/25 text-warning",
  approved: "bg-success/20 text-success",
  rejected: "bg-danger/20 text-danger",
  expired: "bg-surface-2 text-muted",
  locked: "bg-danger/20 text-danger",
};

export function Badge({
  className,
  value,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { value: string }) {
  const key = value.toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone[key] ?? "bg-surface-2 text-muted",
        className,
      )}
      {...props}
    >
      {value}
    </span>
  );
}
