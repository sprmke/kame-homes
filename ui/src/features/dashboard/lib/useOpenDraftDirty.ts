import { useRef } from 'react';

/**
 * Dirty flag for a modal draft that lives in props or local state: captures the
 * draft the moment the modal opens and reports whether it has changed since.
 * The baseline resets when the modal closes, so reopening starts clean.
 */
export function useOpenDraftDirty(open: boolean, draft: unknown): boolean {
  const key = JSON.stringify(draft);
  const baselineRef = useRef<string | null>(null);
  if (!open) baselineRef.current = null;
  else if (baselineRef.current === null) baselineRef.current = key;
  return open && baselineRef.current !== key;
}
