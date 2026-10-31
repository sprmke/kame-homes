import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

const SWIPE_THRESHOLD_PX = 48;
const AUTO_ADVANCE_MS = 5000;

function isCarouselControl(target: EventTarget | null) {
  return Boolean((target as HTMLElement | null)?.closest('[data-carousel-control]'));
}

type UseSwipeCarouselOptions = {
  autoAdvanceMs?: number;
  paused?: boolean;
};

export function useSwipeCarousel(length: number, options: UseSwipeCarouselOptions = {}) {
  const { autoAdvanceMs = AUTO_ADVANCE_MS, paused = false } = options;
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const dragDeltaRef = useRef(0);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, length - 1)));
  }, [length]);

  const goTo = useCallback(
    (next: number) => {
      if (length <= 1) return;
      const wrapped = ((next % length) + length) % length;
      setIndex(wrapped);
    },
    [length]
  );

  const goPrevious = useCallback(() => {
    goTo(index - 1);
  }, [goTo, index]);

  const goNext = useCallback(() => {
    goTo(index + 1);
  }, [goTo, index]);

  useEffect(() => {
    if (length <= 1 || paused || isDragging) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % length);
    }, autoAdvanceMs);

    return () => window.clearInterval(timer);
  }, [autoAdvanceMs, isDragging, length, paused]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (length <= 1) return;
    if (event.button !== 0) return;
    if (isCarouselControl(event.target)) return;
    startXRef.current = event.clientX;
    dragDeltaRef.current = 0;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging || length <= 1) return;
    const delta = event.clientX - startXRef.current;
    dragDeltaRef.current = delta;
    setDragOffset(delta);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const delta = dragDeltaRef.current;
    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      if (delta < 0) goNext();
      else goPrevious();
    }

    setDragOffset(0);
    setIsDragging(false);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragDeltaRef.current = 0;
    setDragOffset(0);
    setIsDragging(false);
  };

  const translateX = length > 1 ? `calc(-${index * 100}% + ${isDragging ? dragOffset : 0}px)` : '0';

  return {
    isDragging,
    goPrevious,
    goNext,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel,
    translateX,
  };
}
