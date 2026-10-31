import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

import { useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';

import {
  MONOLITH_SPOTLIGHT_REST,
  spotlightPositionFromClientRect,
} from '@/features/guest/marketing/showcase/lib/showcaseSpotlight';
import { showcaseAccentHsla } from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';

const SPOTLIGHT_SPRING = { stiffness: 320, damping: 32, mass: 0.35 };

type SpotlightMotion = {
  elRef: RefObject<HTMLElement | null>;
  spotlight: ReturnType<typeof useMotionTemplate>;
  onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void;
};

export function useMonolithHeroSpotlight(
  enabled: boolean,
  accentColor: string,
  hasImage: boolean
): SpotlightMotion {
  const elRef = useRef<HTMLElement>(null);
  const trackingRef = useRef(false);
  const targetX = useMotionValue(MONOLITH_SPOTLIGHT_REST.x);
  const targetY = useMotionValue(MONOLITH_SPOTLIGHT_REST.y);
  const x = useSpring(targetX, SPOTLIGHT_SPRING);
  const y = useSpring(targetY, SPOTLIGHT_SPRING);

  const coreColor = showcaseAccentHsla(accentColor, hasImage ? 0.52 : 0.34);
  const haloColor = showcaseAccentHsla(accentColor, hasImage ? 0.26 : 0.16);
  const spotlight = useMotionTemplate`
    radial-gradient(560px circle at ${x}% ${y}%, ${coreColor}, transparent 54%),
    radial-gradient(920px circle at ${x}% ${y}%, ${haloColor}, transparent 64%)
  `;

  const resetSpotlight = useCallback(() => {
    targetX.set(MONOLITH_SPOTLIGHT_REST.x);
    targetY.set(MONOLITH_SPOTLIGHT_REST.y);
  }, [targetX, targetY]);

  const updateFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = elRef.current;
      if (!el || !enabled) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const next = spotlightPositionFromClientRect(clientX, clientY, rect);
      targetX.set(next.x);
      targetY.set(next.y);
    },
    [enabled, targetX, targetY]
  );

  useEffect(() => {
    if (!enabled) return;

    const onWindowPointerMove = (event: PointerEvent) => {
      if (!trackingRef.current) return;
      updateFromClient(event.clientX, event.clientY);
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    return () => window.removeEventListener('pointermove', onWindowPointerMove);
  }, [enabled, updateFromClient]);

  const onPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      trackingRef.current = true;
      updateFromClient(event.clientX, event.clientY);
    },
    [enabled, updateFromClient]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      updateFromClient(event.clientX, event.clientY);
    },
    [enabled, updateFromClient]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      trackingRef.current = true;
      updateFromClient(event.clientX, event.clientY);
    },
    [enabled, updateFromClient]
  );

  const onPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const next = event.relatedTarget;
      if (next instanceof Node && elRef.current?.contains(next)) return;
      trackingRef.current = false;
      resetSpotlight();
    },
    [enabled, resetSpotlight]
  );

  return {
    elRef,
    spotlight,
    onPointerEnter,
    onPointerMove,
    onPointerDown,
    onPointerLeave,
  };
}
