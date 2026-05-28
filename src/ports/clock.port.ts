/**
 * `ClockPort` — abstracção temporal injectada em core services.
 *
 * Story 1.a.3 (AR-032, AO-71, AO-103, D-04.3').
 *
 * **Regra dura (AO-103):** ESLint bloqueia `setTimeout`/`setInterval` globais
 * em `src/core/**`. Core services dependem APENAS desta interface; nunca de
 * `globalThis.setTimeout` directo. Implementações reais em `src/adapters/clock/`.
 *
 * **Cancel function pattern:** todas as schedule operations retornam uma função
 * que, quando invocada, cancela o timer/interval. Manter o cancel callback se
 * for preciso desfazer (e.g. shutdown handler).
 */

export interface ClockPort {
  /** Wall-clock actual (UTC). */
  now(): Date;

  /**
   * Schedule `fn` para correr depois de `ms` milissegundos.
   * Retorna função que cancela o timer pendente (no-op se já disparou).
   */
  setTimeout(fn: () => void, ms: number): () => void;

  /**
   * Schedule `fn` para correr repetidamente a cada `ms` milissegundos.
   * Retorna função que cancela o interval (no-op se já cancelado).
   */
  setInterval(fn: () => void, ms: number): () => void;
}
