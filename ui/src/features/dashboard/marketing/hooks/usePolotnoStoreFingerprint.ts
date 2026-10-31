import { useEffect, useRef, useState } from 'react';

import { onSnapshot, type IAnyStateTreeNode } from 'mobx-state-tree';

import { marketingContentFingerprint } from '@/features/dashboard/marketing/lib/marketingContentFingerprint';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

const SNAPSHOT_COALESCE_MS = 300;

/**
 * Tracks Polotno canvas edits via MST snapshots.
 * Fingerprint is stored in state (updated only on snapshot / extras change) so
 * parent re-renders do not re-hash `store.toJSON()` or create autosave churn.
 */
export function usePolotnoStoreFingerprint(
  store: PolotnoStore | null,
  extras?: Record<string, unknown>
) {
  const extrasKey = marketingContentFingerprint(extras ?? null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const extrasKeyRef = useRef(extrasKey);
  extrasKeyRef.current = extrasKey;

  useEffect(() => {
    if (!store) {
      setFingerprint((prev) => (prev === null ? prev : null));
      return;
    }

    const compute = () => {
      const next = marketingContentFingerprint({
        polotno: store.toJSON(),
        extras: extrasKeyRef.current,
      });
      setFingerprint((prev) => (prev === next ? prev : next));
    };

    compute();

    let timer: number | undefined;
    const dispose = onSnapshot(store as unknown as IAnyStateTreeNode, () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(compute, SNAPSHOT_COALESCE_MS);
    });

    return () => {
      if (timer) window.clearTimeout(timer);
      dispose();
    };
  }, [store, extrasKey]);

  return fingerprint;
}
