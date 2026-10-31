import { useEffect, useRef, useState, useContext, type ReactNode } from 'react';

import { motion } from 'framer-motion';

import { ShowcaseStyleContext } from '@/features/guest/marketing/showcase/components/ShowcaseStyleProvider';
import { useShowcaseTheme } from '@/features/guest/marketing/showcase/components/ShowcaseThemeProvider';
import { monolithStatValueClass } from '@/features/guest/marketing/showcase/templates/monolith/monolithTypography';

import { cn } from '@/lib/utils';

export function ShowcaseReveal({
  children,
  className,
  reduced,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  reduced?: boolean;
  delay?: number;
}) {
  const styleCtx = useContext(ShowcaseStyleContext);
  const duration = styleCtx?.revealDuration ?? 0.7;

  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function AmenityMarquee({
  items,
  className,
  borderClassName = 'border-white/15',
}: {
  items: string[];
  className?: string;
  borderClassName?: string;
}) {
  if (items.length === 0) return null;
  const row = [...items, ...items];
  return (
    <div className={cn('overflow-hidden border-y', borderClassName, className)} aria-hidden>
      <div className="animate-showcase-marquee flex w-max gap-10 whitespace-nowrap py-4">
        {row.map((item, index) => (
          <span key={`${item}-${index}`} className="text-sm uppercase tracking-[0.18em] opacity-80">
            {item}
            <span className="ml-10 opacity-40">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnimatedStat({
  value,
  label,
  reduced,
}: {
  value: string;
  label: string;
  reduced?: boolean;
}) {
  const { tokens, variant } = useShowcaseTheme();
  const numeric = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  const hasNumber = /^\d+$/.test(value.trim());
  const suffix = value.replace(/[\d.\s]/g, '');
  const [display, setDisplay] = useState(reduced || !hasNumber ? value : `0${suffix}`);
  const seen = useRef(false);

  useEffect(() => {
    if (reduced || !hasNumber || seen.current) return;
    const el = document.getElementById(`stat-${label}`);
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || seen.current) return;
        seen.current = true;
        const start = performance.now();
        const duration = 900;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - t) ** 3;
          setDisplay(`${Math.round(numeric * eased)}${suffix}`);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNumber, label, numeric, reduced, suffix, value]);

  return (
    <div id={`stat-${label}`} className="min-w-0">
      <p
        className={cn(
          'font-instrument tracking-tight',
          variant === 'monolith' ? monolithStatValueClass : '@sm:text-5xl text-4xl'
        )}
      >
        {display}
      </p>
      <p className={cn('mt-1 text-sm uppercase tracking-[0.12em]', tokens.muted)}>{label}</p>
    </div>
  );
}
