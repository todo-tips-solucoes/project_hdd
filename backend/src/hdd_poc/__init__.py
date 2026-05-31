"""HDD v2 — PoC de fundação (Story 1.1).

Prova os 5 critérios do gate de fundação:
1. Idempotência de nó que fez commit sob kill→resume (não duplica).
2. Contexto reconstruído do banco (não depende de --resume para correção).
3. interrupt() retoma sem repetir efeitos (nó puro até o interrupt).
4. Viabilidade de --model no driver subscription.
5. Comportamento sob exaustão de quota / limites da conta (observado).
"""
