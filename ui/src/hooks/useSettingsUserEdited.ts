import { useCallback, useState } from 'react';

/** Tracks whether the host changed a settings field this session (not load-time normalization). */
export function useSettingsUserEdited() {
  const [userEdited, setUserEdited] = useState(false);
  const markUserEdited = useCallback(() => setUserEdited(true), []);
  const resetUserEdited = useCallback(() => setUserEdited(false), []);
  return { userEdited, markUserEdited, resetUserEdited };
}
