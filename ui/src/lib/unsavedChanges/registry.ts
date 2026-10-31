/**
 * Pure store behind the global unsaved-changes guard. Forms register a getter
 * for their dirty state (never a snapshot, so no re-render is needed) and the
 * router blocker / `beforeunload` handler read them at navigation time.
 */

export type GuardSaveResult = boolean | void;

export type GuardNavigation = {
  currentPathname: string;
  currentSearch: string;
  nextPathname: string;
  nextSearch: string;
};

export type UnsavedGuardEntry = {
  id: string;
  isDirty: () => boolean;
  /** Persist the draft. Resolve `false` (or throw) when it failed or validation blocked it. */
  save?: () => Promise<GuardSaveResult> | GuardSaveResult;
  /** Reset local state when the user chooses Discard (only needed if the form stays mounted). */
  discard?: () => void;
  /**
   * `pathname` (default): only leaving the current path is blocked, so in-page
   * `?tab=` / hash changes keep working. `location`: any URL change is blocked
   * (use when a search param unmounts the form).
   */
  blocksOn?: 'pathname' | 'location';
};

function entryBlocks(entry: UnsavedGuardEntry, nav?: GuardNavigation): boolean {
  if (!entry.isDirty()) return false;
  if (!nav) return true;
  if (nav.currentPathname !== nav.nextPathname) return true;
  return entry.blocksOn === 'location' && nav.currentSearch !== nav.nextSearch;
}

export function createUnsavedGuardRegistry() {
  const entries = new Map<string, UnsavedGuardEntry>();

  return {
    register(entry: UnsavedGuardEntry): () => void {
      entries.set(entry.id, entry);
      return () => {
        if (entries.get(entry.id) === entry) entries.delete(entry.id);
      };
    },

    /** Dirty entries that a navigation to `nav` (or a full unload when omitted) would lose. */
    getBlocking(nav?: GuardNavigation): UnsavedGuardEntry[] {
      return [...entries.values()].filter((entry) => entryBlocks(entry, nav));
    },

    hasBlocking(nav?: GuardNavigation): boolean {
      return this.getBlocking(nav).length > 0;
    },

    /** True only when every blocking entry can persist itself, so "Save & leave" is safe to offer. */
    canSaveAll(nav?: GuardNavigation): boolean {
      const blocking = this.getBlocking(nav);
      return blocking.length > 0 && blocking.every((entry) => entry.save);
    },

    /** Saves blocking entries in registration order; stops at the first failure. */
    async saveAll(nav?: GuardNavigation): Promise<boolean> {
      for (const entry of this.getBlocking(nav)) {
        if (!entry.save) return false;
        try {
          if ((await entry.save()) === false) return false;
        } catch {
          return false;
        }
      }
      return true;
    },

    discardAll(nav?: GuardNavigation): void {
      for (const entry of this.getBlocking(nav)) entry.discard?.();
    },
  };
}

export type UnsavedGuardRegistry = ReturnType<typeof createUnsavedGuardRegistry>;
