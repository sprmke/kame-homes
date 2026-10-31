/** Sidebar / launcher indicator while Setup Guide still has required steps. */

let requiredRemaining = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setSetupGuideRequiredRemaining(count: number): void {
  const next = Math.max(0, Math.floor(count));
  if (next === requiredRemaining) return;
  requiredRemaining = next;
  emit();
}

export function clearSetupGuideRequiredRemaining(): void {
  if (requiredRemaining === 0) return;
  requiredRemaining = 0;
  emit();
}

export function subscribeSetupGuideIssues(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSetupGuideRequiredRemaining(): number {
  return requiredRemaining;
}

export function hasSetupGuideIssues(): boolean {
  return requiredRemaining > 0;
}
