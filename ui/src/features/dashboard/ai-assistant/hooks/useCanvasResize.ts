import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react';

import {
  CANVAS_MIN_PX,
  clampCanvasWidth,
  defaultCanvasWidth,
  RAIL_COLLAPSED_PX,
  RAIL_EXPANDED_PX,
  railMustCollapse,
  readCanvasWidth,
  writeCanvasWidth,
} from '@/features/dashboard/ai-assistant/lib/canvasWidth';

const KEY_STEP_PX = 32;

function viewportWidth(): number {
  return typeof window === 'undefined' ? 1440 : window.innerWidth;
}

/**
 * Width + gutter handlers for the AI mode canvas (desktop), plus the rail state it implies.
 * The canvas sits on the right, so dragging the gutter left widens it. Arrow keys resize in
 * 32px steps (accessible separator). The saved width is the host's preference; the rendered
 * width is re-clamped for the current viewport and rail, so a resize or rail toggle never
 * squeezes the chat or the page. Below 1200px the rail stays collapsed while the canvas is open.
 */
export function useCanvasResize({
  railPreferenceCollapsed,
  canvasOpen,
}: {
  railPreferenceCollapsed: boolean;
  canvasOpen: boolean;
}) {
  const [viewport, setViewport] = useState(viewportWidth);
  const [preferred, setPreferred] = useState(readCanvasWidth);
  const [dragging, setDragging] = useState(false);

  const railLocked = canvasOpen && railMustCollapse(viewport);
  const railCollapsed = railPreferenceCollapsed || railLocked;
  const railPx = railCollapsed ? RAIL_COLLAPSED_PX : RAIL_EXPANDED_PX;
  const width = Number.isFinite(preferred)
    ? clampCanvasWidth(preferred, viewport, railPx)
    : defaultCanvasWidth(viewport, railPx);

  const widthRef = useRef(width);
  widthRef.current = width;
  const railPxRef = useRef(railPx);
  railPxRef.current = railPx;

  useEffect(() => {
    const onResize = () => setViewport(viewportWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const commit = useCallback((next: number) => {
    const clamped = clampCanvasWidth(next, viewportWidth(), railPxRef.current);
    setPreferred(clamped);
    return clamped;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = widthRef.current;
      setDragging(true);
      const onMove = (move: PointerEvent) => commit(startWidth + (startX - move.clientX));
      const onUp = () => {
        setDragging(false);
        writeCanvasWidth(widthRef.current);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [commit]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? KEY_STEP_PX : -KEY_STEP_PX;
      writeCanvasWidth(commit(widthRef.current + delta));
    },
    [commit]
  );

  const gutterProps: HTMLAttributes<HTMLDivElement> & { 'data-dragging': boolean } = {
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': 'Resize page',
    'aria-valuemin': CANVAS_MIN_PX,
    'aria-valuenow': width,
    tabIndex: 0,
    onPointerDown,
    onKeyDown,
    'data-dragging': dragging,
  };

  return { width, dragging, gutterProps, railCollapsed, railLocked };
}
