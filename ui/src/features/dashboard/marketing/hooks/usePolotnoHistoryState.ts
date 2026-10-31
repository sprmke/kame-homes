import { useEffect, useState } from 'react';

import { onSnapshot, type IAnyStateTreeNode } from 'mobx-state-tree';

import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

export function usePolotnoHistoryState(store: PolotnoStore | null) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (!store) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }

    const sync = () => {
      setCanUndo(Boolean(store.history.canUndo));
      setCanRedo(Boolean(store.history.canRedo));
    };

    sync();
    const dispose = onSnapshot(store as unknown as IAnyStateTreeNode, sync);
    return dispose;
  }, [store]);

  const undo = () => {
    if (!store?.history.canUndo) return;
    store.history.undo();
  };

  const redo = () => {
    if (!store?.history.canRedo) return;
    store.history.redo();
  };

  return { canUndo, canRedo, undo, redo };
}
