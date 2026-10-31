/**
 * Parking booking status machine — separate from the property `statusMachine.ts` /
 * `workflowOrchestrator.ts` by design (see `.cursor/rules/parking-workflow.mdc`).
 *
 * Side effects (notify, claim, decline, broadcast expiry) live outside this module —
 * it is graph-only so callers can guard transitions before writing any side effects.
 *
 * Mirror: ui/src/features/dashboard/parking/lib/parkingWorkflow.ts (kept in sync manually).
 */

export const PARKING_STATUSES = [
  'PENDING_HOST_ACCEPTANCE',
  'PENDING_PAYMENT',
  'PENDING_REVIEW',
  'READY_FOR_CHECKIN',
  'COMPLETED',
  'CANCELLED',
  'NO_HOST_AVAILABLE',
] as const;

export type ParkingStatus = (typeof PARKING_STATUSES)[number];

export function isParkingStatus(value: string): value is ParkingStatus {
  return (PARKING_STATUSES as readonly string[]).includes(value);
}

const TRANSITION_GRAPH: Record<ParkingStatus, readonly ParkingStatus[]> = {
  PENDING_HOST_ACCEPTANCE: ['PENDING_PAYMENT', 'NO_HOST_AVAILABLE', 'CANCELLED'],
  PENDING_PAYMENT: ['PENDING_REVIEW', 'PENDING_HOST_ACCEPTANCE', 'CANCELLED'],
  PENDING_REVIEW: ['READY_FOR_CHECKIN', 'CANCELLED'],
  READY_FOR_CHECKIN: ['COMPLETED', 'CANCELLED'],
  NO_HOST_AVAILABLE: [],
  CANCELLED: [],
  COMPLETED: [],
};

export function canTransition(from: ParkingStatus, to: ParkingStatus): boolean {
  return TRANSITION_GRAPH[from].includes(to);
}

export function availableTransitions(from: ParkingStatus): ParkingStatus[] {
  return [...TRANSITION_GRAPH[from]];
}
