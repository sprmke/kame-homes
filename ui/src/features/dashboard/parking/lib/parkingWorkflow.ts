/**
 * Parking booking workflow — client-side mirror of `_shared/parkingStatusMachine.ts`.
 * ⚠️  When you change the server graph, update this file too.
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

/** Terminal statuses — no further transitions are valid. */
export const PARKING_TERMINAL_STATUSES: ReadonlySet<ParkingStatus> = new Set([
  'COMPLETED',
  'CANCELLED',
  'NO_HOST_AVAILABLE',
]);
