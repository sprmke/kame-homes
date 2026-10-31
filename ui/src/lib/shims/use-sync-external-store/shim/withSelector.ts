import { useDebugValue, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

function is(x: unknown, y: unknown): boolean {
  return (x === y && (x !== 0 || 1 / (x as number) === 1 / (y as number))) || (x !== x && y !== y);
}

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual: (a: Selection, b: Selection) => boolean = is as (a: Selection, b: Selection) => boolean
): Selection {
  const instRef = useRef<{ hasValue: boolean; value: Selection } | null>(null);
  if (instRef.current === null) {
    instRef.current = { hasValue: false, value: undefined as Selection };
  }
  const inst = instRef.current;

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;

    const memoizedSelector = (nextSnapshot: Snapshot) => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (inst.hasValue && isEqual(inst.value, nextSelection)) {
          memoizedSelection = inst.value;
          return memoizedSelection;
        }
        memoizedSelection = nextSelection;
        return memoizedSelection;
      }

      const currentSelection = memoizedSelection!;
      if (is(memoizedSnapshot!, nextSnapshot)) {
        return currentSelection;
      }

      const nextSelection = selector(nextSnapshot);
      if (isEqual(currentSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return currentSelection;
      }

      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return memoizedSelection;
    };

    const maybeGetServerSnapshot = getServerSnapshot ?? null;

    return [
      () => memoizedSelector(getSnapshot()),
      maybeGetServerSnapshot === null
        ? undefined
        : () => memoizedSelector(maybeGetServerSnapshot()),
    ] as const;
  }, [getSnapshot, getServerSnapshot, selector, isEqual, inst]);

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection);

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value, inst]);

  useDebugValue(value);
  return value;
}
