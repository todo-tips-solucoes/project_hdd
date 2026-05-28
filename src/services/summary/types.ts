/**
 * `types.ts` — tipos públicos do summary generator (Story 1.a.8).
 *
 * Isolados de `summary-generator.service.ts` para respeitar Biome 200-line cap
 * e permitir import livre de `format.ts` + `internals.ts`.
 */

export type SummaryFile = {
  readonly artifact: string;
  readonly path?: string;
  readonly description: string;
};

export type SummaryDecision = {
  readonly n: number;
  readonly decision: string;
  readonly reason: string;
  readonly id?: string;
};

export type SummaryOpenItem = {
  readonly id: string;
  readonly description: string;
};

export type SummaryFinding = {
  readonly verdict: string;
  readonly resolved: ReadonlyArray<string>;
  readonly deferred: ReadonlyArray<string>;
};

export type SummaryMetric = { readonly key: string; readonly value: string };
export type SummaryNextStep = { readonly n: number; readonly description: string };

export type SummaryInput = {
  readonly workflowId: string;
  readonly workflowName: string;
  readonly phase: string;
  readonly projectName: string;
  readonly date: string;
  readonly contexto: string;
  readonly whatWasDone: ReadonlyArray<SummaryFile>;
  readonly decisions: ReadonlyArray<SummaryDecision>;
  readonly tradeoffs: ReadonlyArray<string>;
  readonly openItems: ReadonlyArray<SummaryOpenItem>;
  readonly reviewerFindings?: SummaryFinding;
  readonly metrics: ReadonlyArray<SummaryMetric>;
  readonly nextSteps: ReadonlyArray<SummaryNextStep>;
  readonly diffAgainst?: string;
  readonly diffPaths?: ReadonlyArray<string>;
};

export type SummaryOutput = {
  readonly summaryPath: string;
  readonly gitCommit: string | undefined;
  readonly tierBWordCount: number;
};

export type SummaryError =
  | { readonly kind: "TemplateNotFound"; readonly path: string; readonly cause?: unknown }
  | { readonly kind: "WriteFailure"; readonly path: string; readonly cause: unknown }
  | { readonly kind: "GitCommitFailure"; readonly stderr: string; readonly exitCode: number }
  | { readonly kind: "TierBOverflow"; readonly wordCount: number };

export type GitSpawnResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type GitSpawn = (args: ReadonlyArray<string>) => GitSpawnResult;
