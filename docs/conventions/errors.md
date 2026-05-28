# Throw whitelist (AO-66 refined)

> Canónico derivado de `_bmad-output/planning-artifacts/architecture.md` (Step 04,
> Throw Whitelist Refinada → 11 itens via Boundary Test, linhas 982-1018).
> Esta lista é **EXHAUSTIVA** — qualquer `throw` fora destes 11 casos é
> rejeitado pela ESLint custom rule `no-restricted-syntax: ThrowStatement`
> (Story 1.a.2). Para acrescentar caso novo: requer ADR em `docs/decisions/`
> + edit desta lista + alinhamento com Reviewer Agent.

`throw` é permitido APENAS nestes casos.

## Programmer errors (bugs)

1. `assertNever(x: never)` em discriminated unions exhaustivas
2. `assertInvariant(cond: boolean, msg: string)` em pure domain code

## Boot-time failures (process must exit 1)

3. Config schema validation fail (envalid/Zod no boot)
4. Migration failure após `BEGIN EXCLUSIVE` rollback (boot)
5. Boot-time prerequisite verification failures (docker daemon ausente,
   secrets file inválido, R2 unreachable no first boot)

## Filesystem / state corruption (irrecuperável)

6. Audit log hash chain corruption detectada no boot
7. SQLite database file unreadable / corrupt magic header

## Shutdown handlers (last resort)

8. Shutdown handler force-exit after error logging

## Boundary wrappers (internal throws absorvidos)

9. Async iterator excepção dentro de `for await` — DEVE ter try/catch
   envolvente + Result retorno
10. `ClockPort.setTimeout` callback — DEVE ter try/catch envolvente

## Test code (excluded by ESLint overrides)

11. Test assertion frameworks (`expect`, `assert`) em `*.test.ts` files

---

## Convenção operacional

Cada `throw` whitelistado em `src/**` deve ter, na linha imediatamente acima:

```typescript
// allow-throw: AO-66 #N         ← N é o item da lista (1..10; #11 é tests, isento)
// eslint-disable-next-line no-restricted-syntax -- AO-66 #N
throw new Error("...");
```

O comentário `// allow-throw: AO-66 #N` é grep-able (`git grep "allow-throw: AO-66"`)
para auditoria periódica. O `// eslint-disable-next-line` é o que efectivamente
desactiva a regra para a linha seguinte (o `no-restricted-syntax` actual da Story
1.a.2 é approximation; ESLint custom plugin real é cosmetic deferreable).

## Histórico de mudanças

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-05-28 | 1.0 | Criado em Story 1.a.2; lista de 11 itens copiada verbatim de `architecture.md` AO-66 refined. |
