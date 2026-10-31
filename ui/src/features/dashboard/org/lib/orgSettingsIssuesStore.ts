/** Sidebar indicator when org settings sections need attention. */

let issueSectionIds: string[] = [];
const listeners = new Set<() => void>();

export function setOrgSettingsIssueSections(ids: string[]): void {
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

export function clearOrgSettingsIssueSections(): void {
  if (issueSectionIds.length === 0) return;
  issueSectionIds = [];
  for (const listener of listeners) listener();
}

export function subscribeOrgSettingsIssues(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOrgSettingsIssueSections(): string[] {
  return issueSectionIds;
}

export function hasOrgSettingsIssues(): boolean {
  return issueSectionIds.length > 0;
}
