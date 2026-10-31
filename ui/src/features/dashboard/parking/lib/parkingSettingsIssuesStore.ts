/** Sidebar indicator when parking settings sections need attention. */

let issueSectionIds: string[] = [];
const listeners = new Set<() => void>();

export function setParkingSettingsIssueSections(ids: string[]): void {
  const next = [...ids];
  if (
    next.length === issueSectionIds.length &&
    next.every((id, index) => id === issueSectionIds[index])
  ) {
    return;
  }
  issueSectionIds = next;
  for (const listener of listeners) listener();
}

export function clearParkingSettingsIssueSections(): void {
  if (issueSectionIds.length === 0) return;
  issueSectionIds = [];
  for (const listener of listeners) listener();
}

export function subscribeParkingSettingsIssues(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getParkingSettingsIssueSections(): string[] {
  return issueSectionIds;
}

export function hasParkingSettingsIssues(): boolean {
  return issueSectionIds.length > 0;
}
