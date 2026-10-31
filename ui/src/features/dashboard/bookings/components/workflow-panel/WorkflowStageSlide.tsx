/**
 * Stage-deck slide container.
 *
 * A stage change renders two layers for one beat: the stage being left is kept
 * as a snapshot and animated out while the new one arrives from the opposite
 * edge. Animating only the incoming layer (the earlier approach) read as a fade
 * with a nudge — a push only registers when something visibly departs.
 *
 * Direction comes from the deck index: forward when it grows (browsing ahead or
 * a real transition landing on the next stage), back when it shrinks.
 *
 * Clipping is applied *only* while a transition runs, so popovers and menus
 * inside a resting sub-form are never cut off by an always-on `overflow-hidden`.
 *
 * Touch: a horizontal drag tracks the finger with damping (and a stiffer rubber
 * band at the ends of the deck) before committing, so the panel advertises that
 * it can be swiped. Gestures starting on a form control are ignored, and
 * `touch-pan-y` leaves vertical scrolling to the browser.
 */

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';

import { cn } from '@/lib/utils';

/** Must match the `stage-in-*` animation duration in `tailwind.config.js`. */
const STAGE_TRANSITION_MS = 320;

const SWIPE_DISTANCE_PX = 56;
const SWIPE_HORIZONTAL_RATIO = 1.6;
/** Below this the gesture is still ambiguous, so neither axis claims it. */
const SWIPE_AXIS_LOCK_PX = 10;
const DRAG_DAMPING = 0.45;
const DRAG_MAX_PX = 72;
/** Damping when the deck cannot move that way — a short rubber band, not a wall. */
const DRAG_EDGE_DAMPING = 0.12;
const DRAG_EDGE_MAX_PX = 24;
const DRAG_RELEASE_MS = 220;

const SWIPE_IGNORE_SELECTOR = 'input, textarea, select, [contenteditable="true"], [data-no-swipe]';

type Direction = 'forward' | 'back';

type Props = {
  /** Identity of the rendered stage — changing it replays the transition. */
  stageKey: string;
  /** Deck position, used only to pick the direction. */
  index: number;
  children: ReactNode;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
  className?: string;
};

export function WorkflowStageSlide({
  stageKey,
  index,
  children,
  onSwipePrev,
  onSwipeNext,
  className,
}: Props) {
  const [track, setTrack] = useState({ key: stageKey, index, direction: 'forward' as Direction });
  const [leaving, setLeaving] = useState<{
    key: string;
    node: ReactNode;
    direction: Direction;
  } | null>(null);

  const isFirstRender = useRef(true);
  /** Last committed children, so the outgoing layer can render the old stage. */
  const renderedChildren = useRef<ReactNode>(children);
  const liveLayer = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; axis: 'none' | 'x' | 'y' } | null>(null);

  // Detected during render (not in an effect) so the outgoing layer is present
  // in the very same commit as the incoming one — otherwise it flashes in late.
  if (track.key !== stageKey) {
    const direction: Direction = index >= track.index ? 'forward' : 'back';
    setTrack({ key: stageKey, index, direction });
    if (!isFirstRender.current) {
      setLeaving({ key: track.key, node: renderedChildren.current, direction });
    }
  }

  const animate = !isFirstRender.current;
  isFirstRender.current = false;

  useEffect(() => {
    renderedChildren.current = children;
  });

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), STAGE_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  function setDragOffset(px: number, withTransition: boolean) {
    const node = liveLayer.current;
    if (!node) return;
    node.style.transition = withTransition
      ? `transform ${DRAG_RELEASE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : '';
    node.style.transform = px === 0 ? '' : `translate3d(${px}px, 0, 0)`;
  }

  function resetDrag(withTransition: boolean) {
    setDragOffset(0, withTransition);
    if (!withTransition) return;
    const node = liveLayer.current;
    window.setTimeout(() => {
      if (node) node.style.transition = '';
    }, DRAG_RELEASE_MS);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.touches.length !== 1) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(SWIPE_IGNORE_SELECTOR)) return;
    const touch = event.touches[0];
    drag.current = { x: touch.clientX, y: touch.clientY, axis: 'none' };
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    const touch = event.touches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (start.axis === 'none') {
      if (Math.abs(dx) < SWIPE_AXIS_LOCK_PX && Math.abs(dy) < SWIPE_AXIS_LOCK_PX) return;
      start.axis = Math.abs(dx) > Math.abs(dy) * SWIPE_HORIZONTAL_RATIO ? 'x' : 'y';
    }
    if (start.axis !== 'x') return;

    const canMove = dx < 0 ? Boolean(onSwipeNext) : Boolean(onSwipePrev);
    const damping = canMove ? DRAG_DAMPING : DRAG_EDGE_DAMPING;
    const max = canMove ? DRAG_MAX_PX : DRAG_EDGE_MAX_PX;
    setDragOffset(Math.sign(dx) * Math.min(Math.abs(dx) * damping, max), false);
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = drag.current;
    drag.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch ? touch.clientX - start.x : 0;
    const dy = touch ? touch.clientY - start.y : 0;

    const committed =
      start.axis === 'x' &&
      Math.abs(dx) >= SWIPE_DISTANCE_PX &&
      Math.abs(dx) >= Math.abs(dy) * SWIPE_HORIZONTAL_RATIO;

    // On commit the offset is dropped without easing: the incoming stage's own
    // enter animation takes over from here, so easing back first would stutter.
    resetDrag(!committed);
    if (!committed) return;
    if (dx < 0) onSwipeNext?.();
    else onSwipePrev?.();
  }

  // Both layers come from one keyed list on purpose. Rendering the outgoing
  // stage in a separate JSX slot would give it a new key and remount the whole
  // sub-form — re-running its effects mid-transition. Keyed siblings keep the
  // departing instance intact, and passing back the identical `children` object
  // lets React bail out of re-rendering it at all.
  const layers: { key: string; node: ReactNode; direction: Direction; leaving: boolean }[] = [];
  if (leaving) {
    layers.push({
      key: leaving.key,
      node: leaving.node,
      direction: leaving.direction,
      leaving: true,
    });
  }
  layers.push({ key: track.key, node: children, direction: track.direction, leaving: false });

  return (
    <div
      className={cn('relative touch-pan-y', leaving && 'overflow-hidden', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        drag.current = null;
        resetDrag(true);
      }}
    >
      {layers.map((layer) =>
        layer.leaving ? (
          <div
            key={layer.key}
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-x-0 top-0 z-0 motion-reduce:hidden',
              layer.direction === 'forward'
                ? 'motion-safe:animate-stage-out-forward'
                : 'motion-safe:animate-stage-out-back'
            )}
          >
            {layer.node}
          </div>
        ) : (
          <div
            key={layer.key}
            ref={liveLayer}
            className={cn(
              // Mid-flight the arriving stage must fully cover the one it pushes
              // out. `bg-card` matches the rail's own surface so there is no seam,
              // and `relative z-10` wins the paint order against the absolutely
              // positioned outgoing layer, which would otherwise sit on top.
              // Both are dropped at rest so nothing here can trap a child's
              // absolute positioning or clip a popover.
              leaving && 'bg-card relative z-10',
              animate &&
                (layer.direction === 'forward'
                  ? 'motion-safe:animate-stage-in-forward'
                  : 'motion-safe:animate-stage-in-back')
            )}
          >
            {layer.node}
          </div>
        )
      )}
    </div>
  );
}
