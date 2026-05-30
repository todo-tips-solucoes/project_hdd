# Runbook — Corrupção da audit hash-chain

A audit trail (`_bmad-output/audit/<projeto>/<date>.jsonl`) é tamper-evident:
`this_hash = SHA-256(prev_hash || ts || seq || type || payload)` (1.a.6). Uma
quebra é **detecção** — NÃO se "repara" silenciosamente; preserva-se como
evidência e restaura-se de backup. Ver `[[litestream-restore]]`.

## Sintoma

- `bun run scripts/verify-audit-chain.ts <date>` sai ≠0 com `kind=ChainBreak`.
- Boot do worker falha com `BootAuditFailure` (chain inconsistente).
- Linhas do JSONL editadas/removidas à mão (nunca fazer).

## Diagnóstico

```bash
bun run scripts/verify-audit-chain.ts 2026-05-30
# FAILED ... kind=ChainBreak atLine=<N> expected=<h> actual=<h>
```
- `atLine` aponta a 1ª linha onde `prev_hash` não bate. Tudo a partir daí é suspeito.
- Causas: edição manual, escrita parcial (crash a meio — improvável com O_APPEND <PIPE_BUF), disco corrompido, ou adulteração.

## Passos de Recuperação

1. **NÃO editar nem apagar** o JSONL — é a evidência da adulteração.
2. Copiar o ficheiro afectado para fora (`cp <date>.jsonl <date>.jsonl.evidence`).
3. Restaurar o state + audit da réplica Litestream (`[[litestream-restore]]`):
   o último snapshot íntegro tem a chain válida até ao ponto replicado.
4. Comparar a linha `atLine` com a versão restaurada → identificar o que mudou.
5. Re-arrancar o worker a partir do estado restaurado (boot revalida a chain).

## Verificação

```bash
bun run scripts/verify-audit-chain.ts <date>   # OK verified=<N> lines
systemctl status hdd-worker                     # boot sem BootAuditFailure
```

## Post-mortem

- **Timeline:** quando o `verify` começou a falhar; última verificação OK conhecida.
- **Causa-raiz:** adulteração intencional? falha de disco? bug de escrita?
- **Prevenção:** `audit:verify` periódico (cron); permissões restritas no dir de
  audit; Litestream a replicar (RPO ~1s) garante ponto de restauro recente.
