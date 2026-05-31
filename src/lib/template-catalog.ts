/**
 * `template-catalog.ts` — catálogo tipado dos 6 templates UTILITY (Story 3.3).
 *
 * Fonte da verdade dos templates WhatsApp do HDD (spec completa em
 * `whatsapp-templates-utility.md`). Consumido pelo tracking script (3.3) e, na
 * reconciliação, pelo `clihelper.adapter` (O-3.1-1 → shape Meta-component real).
 *
 * `m1Required`: os 3 mínimos para o M1 viable (FR-026): `hdd_interrupt_p1`,
 * `hdd_summary_finalization`, `hdd_heartbeat`. Buttons = payloads reais do doc
 * (divergem do `PAYLOAD_MAP` 1.a.4 — reconciliação na 3.4, O-3.3-1). Puro, sem I/O.
 */

import { err, ok, type Result } from "./result.ts";

export const TEMPLATE_NAMES = [
  "hdd_interrupt_p1",
  "hdd_interrupt_s1",
  "hdd_interrupt_s2",
  "hdd_summary_finalization",
  "hdd_heartbeat",
  "hdd_release_final",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export type TemplateButton = { readonly index: number; readonly payload: string };

export type TemplateSpec = {
  readonly name: TemplateName;
  readonly trigger: string;
  readonly category: "UTILITY";
  /** Nº de variáveis posicionais ({{N}}) por secção. */
  readonly headerVars: number;
  readonly bodyVars: number;
  readonly footerVars: number;
  readonly buttons: ReadonlyArray<TemplateButton>;
  readonly m1Required: boolean;
};

function btns(...payloads: string[]): ReadonlyArray<TemplateButton> {
  return payloads.map((payload, index) => ({ index, payload }));
}

export const TEMPLATE_CATALOG: Readonly<Record<TemplateName, TemplateSpec>> = {
  hdd_interrupt_p1: {
    name: "hdd_interrupt_p1",
    trigger: "P1",
    category: "UTILITY",
    headerVars: 0,
    bodyVars: 3,
    footerVars: 1,
    buttons: btns("p1_continuar_assim", "p1_mudar_rumo", "p1_ver_detalhes"),
    m1Required: true,
  },
  hdd_interrupt_s1: {
    name: "hdd_interrupt_s1",
    trigger: "S1",
    category: "UTILITY",
    headerVars: 1,
    bodyVars: 3,
    footerVars: 1,
    buttons: btns("s1_aguardar_mais", "s1_forcar_retomar", "s1_cancelar_story"),
    m1Required: false,
  },
  hdd_interrupt_s2: {
    name: "hdd_interrupt_s2",
    trigger: "S2",
    category: "UTILITY",
    headerVars: 1,
    bodyVars: 5,
    footerVars: 1,
    buttons: btns("s2_tentar_novamente", "s2_pular_story", "s2_intervir_manual"),
    m1Required: false,
  },
  hdd_summary_finalization: {
    name: "hdd_summary_finalization",
    trigger: "finalization",
    category: "UTILITY",
    headerVars: 2,
    bodyVars: 11,
    footerVars: 0,
    buttons: btns("fin_aprovar", "fin_rever", "fin_bloquear"),
    m1Required: true,
  },
  hdd_heartbeat: {
    name: "hdd_heartbeat",
    trigger: "heartbeat",
    category: "UTILITY",
    headerVars: 1,
    bodyVars: 6,
    footerVars: 1,
    buttons: btns("hb_ok", "hb_pausar", "hb_snooze_2h"),
    m1Required: true,
  },
  hdd_release_final: {
    name: "hdd_release_final",
    trigger: "release",
    category: "UTILITY",
    headerVars: 1,
    bodyVars: 6,
    footerVars: 1,
    buttons: btns("rel_aprovar", "rel_alteracoes", "rel_bloquear"),
    m1Required: false, // release não é M1-mínimo (antes do release final)
  },
};

export const M1_REQUIRED: ReadonlyArray<TemplateName> = TEMPLATE_NAMES.filter(
  (n) => TEMPLATE_CATALOG[n].m1Required,
);

export const SUBMISSION_STATUSES = ["pending", "submitted", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export type SubmissionState = Readonly<Record<TemplateName, SubmissionStatus>>;

export type SubmissionStateError = {
  readonly kind: "InvalidSubmissionState";
  readonly detail: string;
};

/** Valida `raw` (objecto name→status); chaves desconhecidas / status inválido → err. */
export function parseSubmissionState(raw: unknown): Result<SubmissionState, SubmissionStateError> {
  if (typeof raw !== "object" || raw === null) {
    return err({ kind: "InvalidSubmissionState", detail: "estado não é objecto" });
  }
  const out: Record<string, SubmissionStatus> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.startsWith("_")) continue; // chaves `_`-prefixadas = comentários (ignoradas)
    if (!(TEMPLATE_NAMES as readonly string[]).includes(key)) {
      return err({ kind: "InvalidSubmissionState", detail: `template desconhecido: ${key}` });
    }
    if (!(SUBMISSION_STATUSES as readonly string[]).includes(value as string)) {
      return err({
        kind: "InvalidSubmissionState",
        detail: `status inválido p/ ${key}: ${String(value)}`,
      });
    }
    out[key] = value as SubmissionStatus;
  }
  // Templates ausentes do estado → 'pending' por defeito.
  for (const n of TEMPLATE_NAMES) if (out[n] === undefined) out[n] = "pending";
  return ok(out as SubmissionState);
}

/** M1 viable = os 3 `m1Required` estão `approved`. Devolve os que faltam. */
export function evaluateM1(state: SubmissionState): {
  readonly met: boolean;
  readonly missing: ReadonlyArray<TemplateName>;
} {
  const missing = M1_REQUIRED.filter((n) => state[n] !== "approved");
  return { met: missing.length === 0, missing };
}
