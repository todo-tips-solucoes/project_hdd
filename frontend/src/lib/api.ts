// Cliente da API do painel (HDD). Tipos derivados do OpenAPI (api-types.ts) —
// contract-first, sem drift. Sempre envia o cookie de sessão (credentials).
import type { components } from "./api-types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type User = components["schemas"]["User"];
export type WavesSnapshot = components["schemas"]["WavesSnapshot"];
export type SessionOut = components["schemas"]["SessionOut"];
export type WaveOut = components["schemas"]["WaveOut"];
export type GateOut = components["schemas"]["GateOut"];
export type GateDecisionOut = components["schemas"]["GateDecisionOut"];

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  }
  return (await res.json()) as T;
}

export const loginUrl = (): string => `${API_BASE}/auth/login`;

export const getMe = (): Promise<User> => req<User>("/auth/me");
export const logout = (): Promise<unknown> =>
  req("/auth/logout", { method: "POST" });

export const getWaves = (): Promise<WavesSnapshot> =>
  req<WavesSnapshot>("/api/waves");

export const getGates = (): Promise<GateOut[]> => req<GateOut[]>("/api/gates");
export const getGate = (id: string): Promise<GateOut> =>
  req<GateOut>(`/api/gates/${id}`);

export const approveGate = (id: string): Promise<GateDecisionOut> =>
  req<GateDecisionOut>(`/api/gates/${id}/approve`, { method: "POST" });
export const rejectGate = (id: string): Promise<GateDecisionOut> =>
  req<GateDecisionOut>(`/api/gates/${id}/reject`, { method: "POST" });

// Evento da trilha de auditoria transmitido via SSE (/api/events/stream).
export interface AuditEvent {
  seq: number;
  event_id: string;
  type: string;
  occurred_at: string;
  correlation_id: string;
  actor: string;
  payload: Record<string, unknown>;
}

export const eventStreamUrl = (): string => `${API_BASE}/api/events/stream`;
