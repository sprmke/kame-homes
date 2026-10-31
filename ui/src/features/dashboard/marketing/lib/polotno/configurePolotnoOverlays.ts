import { Popover, Tooltip } from '@blueprintjs/core';

let configured = false;

/**
 * OpenPolotno toolbars use Blueprint Popover/Tooltip. In our admin shell, poppers
 * must share one Blueprint + react-popper instance (see vite dedupe) and use fixed
 * viewport positioning so portaled overlays anchor to toolbar controls.
 */
export function configurePolotnoOverlays() {
  if (configured) return;
  configured = true;

  const popoverDefaults = Popover.defaultProps ?? {};
  Popover.defaultProps = {
    ...popoverDefaults,
    positioningStrategy: 'fixed',
    boundary: 'viewport' as typeof popoverDefaults.boundary,
    rootBoundary: 'viewport' as typeof popoverDefaults.rootBoundary,
    transitionDuration: 0,
  };

  const tooltipDefaults = Tooltip.defaultProps ?? {};
  Tooltip.defaultProps = {
    ...tooltipDefaults,
    transitionDuration: 0,
  };
}

export function isPolotnoOverlayDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return window.localStorage.getItem('kame-polotno-overlay-debug') === '1';
  } catch {
    return false;
  }
}

configurePolotnoOverlays();
