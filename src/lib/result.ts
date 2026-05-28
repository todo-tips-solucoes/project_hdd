/**
 * `Result<T, E>` wrappers para o HDD.
 *
 * Story 1.a.2 (AR-030, AR-031, AO-69, AO-121, D-04.1', D-04.13).
 *
 * Toda a função em `src/core/**` e `src/adapters/**` devolve `Result<T, E>`;
 * `throw` é reservado para os 11 itens da whitelist em `docs/conventions/errors.md`.
 * Este módulo re-exporta o `neverthrow@^8` + adiciona 5 helpers nomeados pela
 * decisão D-04.13 (`pipe`, `fromPromise`, `sequence`, `tap`, `mapTransient`).
 */

import {
  fromPromise as _nvFromPromise,
  err,
  errAsync,
  fromAsyncThrowable,
  fromThrowable,
  ok,
  okAsync,
  Result,
  ResultAsync,
} from "neverthrow";

// Re-export do core `neverthrow` para single import point.
export { err, errAsync, fromAsyncThrowable, fromThrowable, ok, okAsync, Result, ResultAsync };

/**
 * Composição em série de funções `T -> Result<T, E>` aplicadas a um Result inicial.
 * Curto-circuita no primeiro `err`.
 *
 * Equivalente a `initial.andThen(fn1).andThen(fn2)...`. Helper formal por D-04.13.
 *
 * @example
 *   pipe(ok(1), x => ok(x + 1), x => ok(x * 2)) // ok(4)
 *   pipe(ok(1), x => err("boom"), x => ok(x))   // err("boom") — curto-circuito
 */
export function pipe<T, E>(
  initial: Result<T, E>,
  ...fns: ReadonlyArray<(v: T) => Result<T, E>>
): Result<T, E> {
  return fns.reduce<Result<T, E>>((acc, fn) => acc.andThen(fn), initial);
}

/**
 * Promise → ResultAsync com mapper de erro explícito.
 *
 * Força o caller a desambiguar o tipo de erro em vez de deixar `unknown` leak.
 * Wrapper sobre `ResultAsync.fromPromise` do neverthrow (AO-69).
 *
 * @example
 *   fromPromise(fetch(url), e => ({ kind: "NetworkError", cause: e }))
 */
export function fromPromise<T, E>(
  p: Promise<T>,
  errMapper: (raw: unknown) => E,
): ResultAsync<T, E> {
  return _nvFromPromise(p, errMapper);
}

/**
 * All-or-nothing collector: lista de `Result<T, E>` → `Result<readonly T[], E>`.
 * Primeiro `err` curto-circuita; mantém ordem dos `T` no array.
 *
 * @example
 *   sequence([ok(1), ok(2), ok(3)])      // ok([1, 2, 3])
 *   sequence([ok(1), err("x"), ok(3)])   // err("x")
 */
export function sequence<T, E>(rs: ReadonlyArray<Result<T, E>>): Result<readonly T[], E> {
  return Result.combine([...rs]);
}

/**
 * Efeito colateral (debug/logging) sem alterar o Result.
 *
 * **G1 gotcha (architecture.md linha 1188):** `andTee` em neverthrow não força
 * ordem semântica relativamente à execução. Este `tap` é wrapper síncrono que
 * preserva idempotency-first AO-121 — o sideEffect só corre depois do Result
 * já estar materializado, garantido pelo JS event loop síncrono.
 *
 * @example
 *   pipe(ok(1), v => { tap(ok(v), console.log); return ok(v); })
 */
export function tap<T, E>(r: Result<T, E>, sideEffect: (v: T) => void): Result<T, E> {
  if (r.isOk()) sideEffect(r.value);
  return r;
}

/**
 * Alias semântico de `mapErr` para distinguir mapeamento de erros transientes
 * (retry-able pelo adapter) de permanentes (propagar até ao core).
 *
 * Não muda o comportamento de `mapErr`; serve apenas como signal in-code do
 * intent — convenção HDD para Reviewer Agent + análise estática (AO-117 spirit).
 *
 * @example
 *   mapTransient(err("timeout"), e => ({ kind: "Transient", retryAfter: 1000 }))
 */
export function mapTransient<T, E, E2>(r: Result<T, E>, mapper: (e: E) => E2): Result<T, E2> {
  return r.mapErr(mapper);
}
