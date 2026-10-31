/** Sidebar indicator when property settings sections need attention. */

let issueSectionIds: string[] = [];
const listeners = new Set<() => void>();

export function setPropertySettingsIssueSections(ids: string[]): void {
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

export function clearPropertySettingsIssueSections(): void {
  if (issueSectionIds.length === 0) return;
  issueSectionIds = [];
  for (const listener of listeners) listener();
}

export function subscribePropertySettingsIssues(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPropertySettingsIssueSections(): string[] {
  return issueSectionIds;
}

export function hasPropertySettingsIssues(): boolean {
  return issueSectionIds.length > 0;
}
