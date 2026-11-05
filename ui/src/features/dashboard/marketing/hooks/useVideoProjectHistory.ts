import { useCallback, useEffect, useRef, useState } from 'react';

import type { VideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

const MAX_HISTORY = 50;
const COALESCE_MS = 400;

/**
 * History/undo for a video project. Generic because the editor is mid-migration: the v1
 * scene project and the v2 track project are different shapes and both need the same
 * undo behaviour. `T` defaults to v1 so existing call sites stay unchanged.
 */
function cloneProject<T>(project: T): T {
  return structuredClone(project);
}

/** Text entry only: a focused slider or checkbox must not swallow undo/redo. */
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  const tag = target.tagName;
  return tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useVideoProjectHistory<T = VideoProject>() {
  const [project, setProjectState] = useState<T | null>(null);
  const historyRef = useRef<T[]>([]);
  const indexRef = useRef(-1);
  const skipPushRef = useRef(false);
  const lastCoalesceAtRef = useRef(0);
  const [revision, setRevision] = useState(0);

  const bumpRevision = useCallback(() => setRevision((value) => value + 1), []);

  const pushSnapshot = useCallback(
    (next: T, options?: { force?: boolean }) => {
      const clone = cloneProject(next);
      const history = historyRef.current.slice(0, indexRef.current + 1);
      const now = Date.now();
      const coalesce =
        !options?.force &&
        now - lastCoalesceAtRef.current < COALESCE_MS &&
        history.length > 0 &&
        indexRef.current === history.length - 1;

      if (coalesce) {
        history[history.length - 1] = clone;
      } else {
        history.push(clone);
        if (history.length > MAX_HISTORY) {
          history.shift();
        }
      }

      indexRef.current = history.length - 1;
      historyRef.current = history;
      lastCoalesceAtRef.current = now;
      bumpRevision();
    },
    [bumpRevision]
  );

  const setProject = useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) => {
      setProjectState((prev) => {
        const next =
          typeof updater === 'function' ? (updater as (prev: T | null) => T | null)(prev) : updater;
        if (next && !skipPushRef.current && next !== prev) {
          pushSnapshot(next);
        }
        return next;
      });
    },
    [pushSnapshot]
  );

  /**
   * System fix-ups that are not the host's edits (default music resolving to a URL,
   * cached track): update the project and the current undo snapshot in place, so
   * they never count as an edit or add an undo step.
   */
  const amendProject = useCallback(
    (updater: (prev: T | null) => T | null) => {
      setProjectState((prev) => {
        const next = updater(prev);
        if (next && next !== prev && indexRef.current >= 0) {
          const history = historyRef.current.slice();
          history[indexRef.current] = cloneProject(next);
          historyRef.current = history;
        }
        return next;
      });
    },
    []
  );

  const replaceProject = useCallback(
    (next: T | null) => {
      skipPushRef.current = true;
      setProjectState(next);
      skipPushRef.current = false;

      if (next) {
        historyRef.current = [cloneProject(next)];
        indexRef.current = 0;
      } else {
        historyRef.current = [];
        indexRef.current = -1;
      }
      lastCoalesceAtRef.current = 0;
      bumpRevision();
    },
    [bumpRevision]
  );

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current -= 1;
    const snapshot = historyRef.current[indexRef.current];
    if (!snapshot) return;
    skipPushRef.current = true;
    setProjectState(cloneProject(snapshot));
    skipPushRef.current = false;
    bumpRevision();
  }, [bumpRevision]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current += 1;
    const snapshot = historyRef.current[indexRef.current];
    if (!snapshot) return;
    skipPushRef.current = true;
    setProjectState(cloneProject(snapshot));
    skipPushRef.current = false;
    bumpRevision();
  }, [bumpRevision]);

  const canUndo = revision >= 0 && indexRef.current > 0;
  const canRedo = revision >= 0 && indexRef.current < historyRef.current.length - 1;

  /** The host changed something since the last `replaceProject` (undo history grew). */
  const edited = revision >= 0 && historyRef.current.length > 1;

  return { project, setProject, amendProject, replaceProject, undo, redo, canUndo, canRedo, edited };
}

export function useVideoProjectHistoryShortcuts({
  undo,
  redo,
  enabled = true,
}: {
  undo: () => void;
  redo: () => void;
  enabled?: boolean;
}) {
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoRef.current();
        return;
      }
      if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redoRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
