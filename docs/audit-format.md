# HDD Audit JSONL Format (v1)

> Canónico introduzido em **Story 1.a.6** (commit a chegar). Aplica-se a todo
> o output em `_bmad-output/audit/<project>/<date>.jsonl`. Verificável via
> `bun run audit:verify <date>`.

## Propósito

Trail tamper-evident de todas as decisões, side-effects e interrupts do worker
HDD. Permite:

1. **Forensic verification** — chain SHA-256 detecta qualquer alteração retroactiva.
2. **Crash recovery** — reconciliar estado do worker a partir do audit log.
3. **Compliance** — `.tsr` daily prova que o ficheiro existiu antes de uma data
   externamente (v1.1+ com TSA real; v1 é mock per Q-A6-3).
4. **Debug** — re-construir sequência exacta de eventos.

## Formato canónico

### Linha (1 evento = 1 linha JSON, `\n` separator)

```json
{"ts":"2026-05-28T20:15:30.123Z","seq":42,"run_id":"run-abc","story_id":"story-007","type":"INTERRUPT_TRIGGERED","payload":{"trigger":"P1"},"prev_hash":"6b86b273ff34fce19d6b...","this_hash":"e3b0c44298fc1c149afb..."}
```

### Ordem de chaves (estável, garantida pelo adapter)

`ts`, `seq`, `run_id`, `story_id`, `type`, `payload`, `prev_hash`, `this_hash`.

### Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| `ts` | string ISO 8601 UTC | timestamp do caller (não do disco) |
| `seq` | integer ≥ 0 | reset a 0 a cada rotation diária |
| `run_id` | string | branded `RunId` upstream |
| `story_id` | string \| null | branded `StoryId`; null se evento não é story-bound |
| `type` | string | discriminator (e.g. `STORY_STARTED`, `INTERRUPT_TRIGGERED`) |
| `payload` | object | crú; **NÃO sanitizado** em v1 (ver Redaction abaixo) |
| `prev_hash` | string | SHA-256 hex da linha anterior, OU literal `"genesis"` se primeira |
| `this_hash` | string | SHA-256 hex desta linha (formula abaixo) |

### Algoritmo de hash

```
this_hash = SHA-256( prev_hash || "|" || ts || "|" || seq || "|" || type || "|" || canonical(payload) )
```

Onde `canonical(payload)` é `JSON.stringify(payload, Object.keys(payload).sort())`.

Q-A6-1 (Story 1.a.6) escolheu **flat sort top-level**: keys de primeiro nível
ordenadas alfabeticamente, sub-objects mantêm ordem original. Suficiente para
v1 (payloads HDD são shallow). Future enhancement = JCS (RFC 8785) se complexity
crescer.

### Exemplo trabalhado

Primeira linha do ficheiro do dia (`prev_hash = "genesis"`):

```
ts        = "2026-05-28T20:15:30.123Z"
seq       = 0
type      = "STORY_STARTED"
payload   = { "story_id": "story-007", "phase": "dev" }
canonical = '{"phase":"dev","story_id":"story-007"}'
input     = "genesis|2026-05-28T20:15:30.123Z|0|STORY_STARTED|{\"phase\":\"dev\",\"story_id\":\"story-007\"}"
this_hash = SHA-256(input).hex
```

## Atomicidade (O_APPEND)

Append é feito via `fs.openSync(path, "a")` + `writeSync` + `closeSync`. O modo
`"a"` mapeia para syscall `O_APPEND` que garante append atómico até **PIPE_BUF**
(≈4KB em Linux, 512 bytes POSIX mínimo).

Payloads HDD são tipicamente <1KB; risco de interleaving é baixo. **Se** payload
ultrapassar 4KB, atomicidade não é garantida pelo kernel — caller deve
particionar.

## Rotation

**v1 (Story 1.a.6):** date-based only. Midnight UTC boundary detecta via
`clock.now().toISOString().slice(0,10)`. Quando date muda:

1. Emite `.tsr` stub para o ficheiro `<old-date>.jsonl`.
2. Reset `seq = 0`, `prev_hash = "genesis"` para o novo ficheiro.

**v1.1+ (deferido):** size-based também (100MB hit per AR-062). Implementado em
Story 1.c.3 (ops) quando audit volume justificar.

## Retention

| Local | TTL | Detalhe |
|-------|-----|---------|
| `_bmad-output/audit/` | 90 dias | Cleanup manual v1; cron v1.1+ |
| R2 EU (Litestream) | 1 ano | Story 1.c.3 wiring |

## `.tsr` (RFC 3161 stub)

**v1 (Story 1.a.6):** mock JSON file co-localizado com o `<date>.jsonl`:

```json
{
  "stub_version": 1,
  "covered_file": "/path/to/2026-05-28.jsonl",
  "covered_sha256": "<sha256 do ficheiro completo>",
  "ts_local": "2026-05-29T00:00:00.001Z",
  "tsa_real": false,
  "note": "TSA real diferida v1.1+ per AR-061"
}
```

**v1.1+ (deferido):** FreeTSA HTTP call producing real binary `.tsr` (RFC 3161
TimeStampToken). Storage permanece junto do JSONL.

## ⚠️ Redaction — responsabilidade do caller em v1

**AR-063 / AO-160 / AO-166** mandatam redaction multi-pattern (tokens Anthropic,
Bearer, Authorization headers, `wa_id`, números telefone, n8n payloads verbose).
**NÃO** é implementada nesta story.

Em v1, o **caller** de `audit.append()` é responsável por sanitizar `payload`
antes de invocar. Story **1.b.3** adicionará middleware de redaction automática
(AR-063 BLOCKER M1).

Workaround temporário: aplicar `truffleHog` em CI sobre os ficheiros JSONL
committed (não deviam haver — gitignored), OU manualmente antes de qualquer
debug session que exponha o audit log.

## Recovery em caso de chain break

`bun run audit:verify <date>` retorna `err({kind: 'ChainBreak', atLine: N, ...})`.

Procedimento:

1. **Truncar** o ficheiro `<date>.jsonl` no fim da linha `N-1` íntegra.
2. **Restaurar** linhas posteriores via Litestream replay (Story 1.c.3) se
   disponível, OU aceitar perda e reconciliar `audit_chain_state.last_hash`
   na DB para corresponder à linha `N-1`.
3. **Log incident** em `docs/incidents/` (Story 5.x; manual v1).

## Comandos

```bash
bun run audit:verify             # default = today
bun run audit:verify 2026-05-28  # date específica
bun run audit:verify --all       # diferido v1.1+
```

Exit codes:

- `0` — chain íntegra; output `[audit:verify] OK date=YYYY-MM-DD verified=N lines`.
- `1` — break detectado OR ficheiro não encontrado; output detalhado em stderr.

## Histórico

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-05-28 | 1.0 | Criado em Story 1.a.6 (commit a chegar). Format inicial. |
