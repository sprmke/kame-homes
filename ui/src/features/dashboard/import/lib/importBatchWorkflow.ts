/**
 * Import batch workflow — client mirror of importBatchStatusMachine.ts.
 */

export const IMPORT_BATCH_STATUSES = [
  'uploaded',
  'mapping',
  'mapped',
  'previewing',
  'previewed',
  'committing',
  'committed',
  'reverting',
  'reverted',
  'failed',
] as const;

export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export function isImportBatchStatus(value: string): value is ImportBatchStatus {
  return (IMPORT_BATCH_STATUSES as ReadonlyArray<string>).includes(value);
}

const TRANSITION_GRAPH: Record<ImportBatchStatus, ReadonlyArray<ImportBatchStatus>> = {
  uploaded: ['mapping', 'failed'],
  mapping: ['mapped', 'failed'],
  mapped: ['previewing', 'failed'],
  previewing: ['previewed', 'failed'],
  previewed: ['committing', 'failed'],
  committing: ['committed', 'failed'],
  committed: ['reverting'],
  reverting: ['reverted'],
  reverted: [],
  failed: [],
};

export type ImportBatchTransitionContext = {
  manual?: boolean;
};

export function canImportBatchTransition(
  from: ImportBatchStatus,
  to: ImportBatchStatus,
  _ctx: ImportBatchTransitionContext = {}
): boolean {
  return (TRANSITION_GRAPH[from] ?? []).includes(to);
}

export function availableImportBatchTransitions(from: ImportBatchStatus): ImportBatchStatus[] {
  return [...(TRANSITION_GRAPH[from] ?? [])];
}
