# Runbook — Conformidade LGPD (Story 5.6)

Como o HDD trata dados pessoais: pseudonimização, crypto-shredding (direito à
exclusão), retenção e transferência internacional.

## Camadas de proteção de PII

| Onde | Tratamento | Direito à exclusão |
|---|---|---|
| `audit.events` (hash-chain) | **Sem PII** — payload pseudonimizado; append-only (trigger + role + hash). | Imutável **por design** — não contém dado pessoal a apagar. |
| `memory.items` (pgvector) | PII **mascarada** (`domain/pii.py`: e-mails/telefones → `[email]`/`[phone]`) antes de embeddar. | Mascaramento é irreversível (one-way). |
| `lgpd.pii_vault` | PII recuperável **cifrada** por titular (pgcrypto). | **Crypto-shredding** (abaixo). |

> Invariante (Story 5.6): o crypto-shredding mira **apenas** o cofre `lgpd`;
> **nunca** toca `audit.events`. A hash-chain permanece íntegra.

## Crypto-shredding (direito à exclusão / "direito ao esquecimento")

Cada titular tem uma **DEK** (chave de cifra aleatória) em `lgpd.subject_key`. A
PII recuperável fica em `lgpd.pii_vault` cifrada com `pgp_sym_encrypt` usando essa
DEK. A chave nunca passa pela aplicação — cifra/decifra ocorrem no SQL.

**Exclusão** descarta a DEK do titular. A partir daí, todo o ciphertext dele é
**permanentemente indecifrável** — inclusive cópias em backups/replicas/WAL que
não se pode alcançar fisicamente (é a vantagem sobre um `DELETE` comum).

```bash
# Pedido de exclusão de um titular (SUBJECT_ID = identificador pseudónimo):
uv run hdd forget <subject_id>
# → descarta a chave + registra o evento lgpd.erased na auditoria (sem PII).
```

O ato de exclusão é auditado (`EventType.LGPD_ERASED`, payload só com o
`subject_id` pseudónimo) — prova de conformidade sem reintroduzir PII.

> `subject_id` deve ser **pseudónimo** (ex.: hash salgado do telefone/e-mail),
> nunca o dado em claro — coerente com `domain/pii.py`.

### Verificação

```sql
-- após o shred: a chave sumiu, o ciphertext residual é lixo indecifrável
SELECT count(*) FROM lgpd.subject_key WHERE subject_id = '<id>';   -- 0
SELECT pgp_sym_decrypt(ciphertext, encode(gen_random_bytes(32),'hex'))
  FROM lgpd.pii_vault WHERE subject_id = '<id>';                   -- ERRO: wrong key
```

Cobertura: `tests/integration/test_lgpd.py` (decifra → shred → indecifrável;
hash-chain de auditoria intocada).

## Política de retenção

| Dado | Retenção | Base / mecanismo |
|---|---|---|
| `audit.events` | Permanente (trilha imutável; obrigação de prestação de contas). | Sem PII — não sujeito a exclusão. |
| `lgpd.pii_vault` | Enquanto necessário à finalidade; exclusão a pedido via crypto-shredding. | Art. 18 LGPD (eliminação). |
| `memory.items` | Vida útil do projeto; PII já mascarada. | Minimização. |
| Backups WAL/PITR (R2) | Janela de retenção do backup (ver `backup-restore.md`); chaves shredded **não** voltam num restore. | Crypto-shredding cobre o backup. |

## Transferência internacional de dados

O processamento envolve duas jurisdições:

- **Hetzner (Alemanha/UE)** — hospedagem do control plane e do Postgres. Dados
  em repouso na UE.
- **Anthropic (EUA)** — o motor `claude -p` processa o conteúdo das tarefas.
  Transferência UE→EUA.

Salvaguardas: enviar à Anthropic **apenas o necessário** (o conteúdo já passa por
pseudonimização antes de qualquer persistência; PII bruta não deve compor o
prompt). A base legal da transferência internacional (art. 33 LGPD —
cláusulas-padrão contratuais / adequação) deve constar do contrato com a
Anthropic e do Registro de Operações de Tratamento (ROPA) do projeto.

> Ação aberta (não-código): anexar ao ROPA o DPA da Anthropic e da Hetzner e a
> base legal de transferência. Este runbook documenta o mecanismo técnico; a
> formalização jurídica é responsabilidade do controlador.
