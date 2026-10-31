import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';

import { motion } from 'framer-motion';

import { ShowcaseReveal } from '@/features/guest/marketing/showcase/components/ShowcaseMotion';
import { useShowcaseContainedChrome } from '@/features/guest/marketing/showcase/lib/showcaseChrome';
import {
  resolveShowcaseMotionReduced,
  resolveShowcaseParallaxEnabled,
} from '@/features/guest/marketing/showcase/lib/showcaseStyleConfig';
import {
  useAuroraSectionParallax,
  type AuroraSectionParallaxLayer,
} from '@/features/guest/marketing/showcase/templates/aurora/useAuroraSectionParallax';
import type { ShowcaseData } from '@/features/guest/marketing/showcase/types/showcase';

import { cn } from '@/lib/utils';

type ParallaxContextValue = {
  sectionRef: RefObject<HTMLElement | null>;
  data: ShowcaseData;
  parallaxEnabled: boolean;
  motionReduced: boolean;
  containedChrome: boolean;
};

const AuroraParallaxContext = createContext<ParallaxContextValue | null>(null);

function useAuroraParallaxContext() {
  const ctx = useContext(AuroraParallaxContext);
  if (!ctx) {
    throw new Error('Aurora parallax components must be used inside AuroraParallaxSection');
  }
  return ctx;
}

type SectionProps = {
  id: string;
  data: ShowcaseData;
  className?: string;
  children: ReactNode;
};

/** Section shell with optional ambient parallax accents. */
export function AuroraParallaxSection({ id, data, className, children }: SectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const parallaxEnabled = resolveShowcaseParallaxEnabled(
    data.config,
    data.reducedMotion,
    data.embed
  );
  const accent = useAuroraSectionParallax(sectionRef, {
    enabled: parallaxEnabled,
    intensity: data.config.motion.intensity,
    contained: containedChrome,
    embed: data.embed,
    layer: 'accent',
  });

  return (
    <AuroraParallaxContext.Provider
      value={{
        sectionRef,
        data,
        parallaxEnabled,
        motionReduced,
        containedChrome,
      }}
    >
      <section
        ref={sectionRef}
        id={id}
        data-page-editor-anchor={id}
        className={cn('relative scroll-mt-20 overflow-hidden', className)}
      >
        {parallaxEnabled ? (
          <>
            <motion.div
              className="bg-primary/14 pointer-events-none absolute -left-16 top-8 size-56 rounded-full blur-3xl"
              style={{ y: accent.y, opacity: accent.opacity }}
              aria-hidden
            />
            <motion.div
              className="bg-sky-400/12 pointer-events-none absolute -right-12 bottom-0 size-48 rounded-full blur-3xl"
              style={{
                y: accent.y,
                scale: 1.08,
                opacity: accent.opacity,
              }}
              aria-hidden
            />
            <motion.div
              className="bg-primary/8 pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl"
              style={{
                y: accent.y,
                opacity: accent.opacity,
              }}
              aria-hidden
            />
          </>
        ) : null}
        <div className="relative z-[1]">{children}</div>
      </section>
    </AuroraParallaxContext.Provider>
  );
}

/** Wraps blocks below the hero with scroll parallax + reveal. */
export function AuroraParallaxContainer({ data, className, children }: Omit<SectionProps, 'id'>) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const containedChrome = useShowcaseContainedChrome(data.embed);
  const motionReduced = resolveShowcaseMotionReduced(data.config, data.reducedMotion, data.embed);
  const parallaxEnabled = resolveShowcaseParallaxEnabled(
    data.config,
    data.reducedMotion,
    data.embed
  );
  const accent = useAuroraSectionParallax(sectionRef, {
    enabled: parallaxEnabled,
    intensity: data.config.motion.intensity,
    contained: containedChrome,
    embed: data.embed,
    layer: 'accent',
  });

  return (
    <AuroraParallaxContext.Provider
      value={{
        sectionRef,
        data,
        parallaxEnabled,
        motionReduced,
        containedChrome,
      }}
    >
      <div ref={sectionRef} className={cn('relative overflow-hidden', className)}>
        {parallaxEnabled ? (
          <motion.div
            className="bg-primary/10 pointer-events-none absolute -right-20 top-1/3 size-52 rounded-full blur-3xl"
            style={{ y: accent.y, opacity: accent.opacity }}
            aria-hidden
          />
        ) : null}
        <div className="relative z-[1]">{children}</div>
      </div>
    </AuroraParallaxContext.Provider>
  );
}

export function AuroraParallaxReveal({
  children,
  className,
  delay = 0,
  layer = 'content',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  layer?: AuroraSectionParallaxLayer;
}) {
  const { sectionRef, data, parallaxEnabled, motionReduced, containedChrome } =
    useAuroraParallaxContext();
  const scrollLayer = useAuroraSectionParallax(sectionRef, {
    enabled: parallaxEnabled,
    intensity: data.config.motion.intensity,
    contained: containedChrome,
    embed: data.embed,
    layer,
  });

  if (motionReduced || !parallaxEnabled) {
    return (
      <ShowcaseReveal reduced={motionReduced} delay={delay} className={className}>
        {children}
      </ShowcaseReveal>
    );
  }

  return (
    <motion.div className={className} style={{ y: scrollLayer.y }}>
      <motion.div
        initial={{ opacity: 0, y: 48, filter: 'blur(10px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-8% 0px' }}
        transition={{ duration: 0.82, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function AuroraParallaxLayer({
  children,
  className,
  layer = 'content',
}: {
  children: ReactNode;
  className?: string;
  layer?: AuroraSectionParallaxLayer;
}) {
  const { sectionRef, data, parallaxEnabled, motionReduced, containedChrome } =
    useAuroraParallaxContext();
  const scrollLayer = useAuroraSectionParallax(sectionRef, {
    enabled: parallaxEnabled,
    intensity: data.config.motion.intensity,
    contained: containedChrome,
    embed: data.embed,
    layer,
  });

  if (motionReduced || !parallaxEnabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} style={{ y: scrollLayer.y }}>
      {children}
    </motion.div>
  );
}
