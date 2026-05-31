/**
 * `payload-schema.ts` — Zod schema do body outbound clihelper (Story 3.1).
 *
 * Body conforme arch:655: `{number, name, language='pt_BR', openTicket, queueId,
 * template[]}`. `.strict()` — qualquer campo extra é rejeitado (fail-closed, AC4).
 *
 * ⚠️ Q-3.1-2 [RESOLVED]: a arquitectura lista `template[]` mas NÃO a estrutura
 * interna de cada elemento. O shape abaixo (`{name, parameters:[{key,value}]}`) é
 * uma **assumção documentada pendente de confirmação do operador** (open item
 * O-3.1-1) — análogo ao webhook inbound (O-B5-3) mas para outbound. `vars` named
 * (Record) mapeiam para `parameters[]`; `-sem-variavel` → `parameters` vazio.
 */

import { z } from "zod";

export const clihelperTemplateEntrySchema = z
  .object({
    name: z.string().min(1),
    parameters: z.array(z.object({ key: z.string(), value: z.string() }).strict()),
  })
  .strict();

export const clihelperBodySchema = z
  .object({
    number: z.string().min(1),
    name: z.string(),
    language: z.literal("pt_BR"),
    openTicket: z.boolean(),
    queueId: z.string().min(1),
    template: z.array(clihelperTemplateEntrySchema).min(1),
  })
  .strict();

export type ClihelperBody = z.infer<typeof clihelperBodySchema>;
export type ClihelperTemplateEntry = z.infer<typeof clihelperTemplateEntrySchema>;
