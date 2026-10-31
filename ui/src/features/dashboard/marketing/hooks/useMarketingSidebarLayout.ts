import { useCallback, useSyncExternalStore } from 'react';

export type MarketingSidebarLayoutKey = 'calendar' | 'design' | 'video' | 'page-editor';

/** Shared default width (px) for Calendar, Design, and Video sidebars. */
export const MARKETING_SIDEBAR_DEFAULT_WIDTH = 288;

/** Collapsed rail width (px) — matches w-11. */
export const MARKETING_SIDEBAR_COLLAPSED_WIDTH = 44;

/** Drag below this width (px) on release → collapsed sidebar. */
export const MARKETING_SIDEBAR_COLLAPSE_THRESHOLD = 160;

const MIN_WIDTH = 220;
const MAX_WIDTH = 480;

type StoredLayout = {
  width: number;
  collapsed: boolean;
};

type LayoutStore = {
  layout: StoredLayout;
  listeners: Set<() => void>;
};

const stores = new Map<MarketingSidebarLayoutKey, LayoutStore>();

const SERVER_SNAPSHOT: StoredLayout = {
  width: MARKETING_SIDEBAR_DEFAULT_WIDTH,
  collapsed: false,
};

function storageKey(layoutKey: MarketingSidebarLayoutKey) {
  return `marketing-editor-sidebar:${layoutKey}`;
}

function clampExpandedWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

function clampResizePreview(width: number) {
  return Math.min(MAX_WIDTH, Math.max(0, Math.round(width)));
}

function loadLayout(layoutKey: MarketingSidebarLayoutKey): StoredLayout {
  if (typeof window === 'undefined') {
    return { width: MARKETING_SIDEBAR_DEFAULT_WIDTH, collapsed: false };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(layoutKey));
    if (!raw) {
      return { width: MARKETING_SIDEBAR_DEFAULT_WIDTH, collapsed: false };
    }
    const parsed = JSON.parse(raw) as Partial<StoredLayout>;
    return {
      width: clampExpandedWidth(parsed.width ?? MARKETING_SIDEBAR_DEFAULT_WIDTH),
      collapsed: Boolean(parsed.collapsed),
    };
  } catch {
    return { width: MARKETING_SIDEBAR_DEFAULT_WIDTH, collapsed: false };
  }
}

function saveLayout(layoutKey: MarketingSidebarLayoutKey, layout: StoredLayout) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(layoutKey), JSON.stringify(layout));
}

function getStore(layoutKey: MarketingSidebarLayoutKey): LayoutStore {
  let store = stores.get(layoutKey);
  if (!store) {
    store = {
      layout: loadLayout(layoutKey),
      listeners: new Set(),
    };
    stores.set(layoutKey, store);
  }
  return store;
}

function subscribe(layoutKey: MarketingSidebarLayoutKey, onStoreChange: () => void) {
  const store = getStore(layoutKey);
  store.listeners.add(onStoreChange);
  return () => {
    store.listeners.delete(onStoreChange);
  };
}

function getSnapshot(layoutKey: MarketingSidebarLayoutKey) {
  return getStore(layoutKey).layout;
}

function updateLayout(
  layoutKey: MarketingSidebarLayoutKey,
  updater: (prev: StoredLayout) => StoredLayout,
  persist = true
) {
  const store = getStore(layoutKey);
  const next = updater(store.layout);
  store.layout = next;
  if (persist) saveLayout(layoutKey, next);
  store.listeners.forEach((listener) => listener());
}

/** Shared across all hook consumers for the same `layoutKey` (e.g. preview → collapse sidebar). */
export function useMarketingSidebarLayout(layoutKey: MarketingSidebarLayoutKey) {
  const layout = useSyncExternalStore(
    (onStoreChange) => subscribe(layoutKey, onStoreChange),
    () => getSnapshot(layoutKey),
    () => SERVER_SNAPSHOT
  );

  const setWidth = useCallback(
    (width: number, persist = true) => {
      const nextWidth = persist ? clampExpandedWidth(width) : clampResizePreview(width);
      updateLayout(layoutKey, (prev) => ({ ...prev, width: nextWidth }), persist);
    },
    [layoutKey]
  );

  const finishResize = useCallback(
    (width: number, expandedWidthBeforeDrag: number) => {
      if (width < MARKETING_SIDEBAR_COLLAPSE_THRESHOLD) {
        updateLayout(layoutKey, () => ({
          collapsed: true,
          width: clampExpandedWidth(expandedWidthBeforeDrag),
        }));
        return;
      }

      updateLayout(layoutKey, () => ({
        collapsed: false,
        width: clampExpandedWidth(width),
      }));
    },
    [layoutKey]
  );

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      updateLayout(layoutKey, (prev) => ({ ...prev, collapsed }));
    },
    [layoutKey]
  );

  const expandSidebar = useCallback(() => {
    updateLayout(layoutKey, () => ({
      collapsed: false,
      width: MARKETING_SIDEBAR_DEFAULT_WIDTH,
    }));
  }, [layoutKey]);

  return {
    width: layout.width,
    collapsed: layout.collapsed,
    setWidth,
    setCollapsed,
    expandSidebar,
    finishResize,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    defaultWidth: MARKETING_SIDEBAR_DEFAULT_WIDTH,
    collapseThreshold: MARKETING_SIDEBAR_COLLAPSE_THRESHOLD,
  };
}
