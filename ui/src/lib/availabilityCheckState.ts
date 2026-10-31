export type AvailabilityCheckState = 'idle' | 'checking' | 'available' | 'unavailable';

export function resolveNameAvailabilityState(options: {
  ready: boolean;
  showChecking: boolean;
  isUnavailable: boolean;
  isFetched: boolean;
}): AvailabilityCheckState {
  const { ready, showChecking, isUnavailable, isFetched } = options;
  if (!ready) return 'idle';
  if (showChecking) return 'checking';
  if (isUnavailable) return 'unavailable';
  if (isFetched) return 'available';
  return 'idle';
}

export function resolveAsyncAvailabilityState(options: {
  ready: boolean;
  isChecking: boolean;
  hasConflict: boolean;
}): AvailabilityCheckState {
  const { ready, isChecking, hasConflict } = options;
  if (!ready) return 'idle';
  if (isChecking) return 'checking';
  if (hasConflict) return 'unavailable';
  return 'available';
}
