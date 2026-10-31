import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from 'framer-motion';

import { useShowcaseScrollProgress } from '@/features/guest/marketing/showcase/templates/aurora/useShowcaseScrollProgress';

import { cn } from '@/lib/utils';

/* ============================================================= *
 * Kinetic motion primitives for the Verso / Atlas templates.
 * Every helper degrades to a plain, static render when `reduced`
 * is true (OS reduced-motion or Subtle motion intensity).
 * ============================================================= */

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Word-by-word "rise into place" reveal — for oversized display headings.
 *  `immediate` plays on mount (heroes); otherwise it plays on scroll-into-view. */
export function MaskText({
  text,
  className,
  wordClassName,
  reduced,
  stagger = 0.05,
  delay = 0,
  immediate = false,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  reduced?: boolean;
  stagger?: number;
  delay?: number;
  immediate?: boolean;
}) {
  if (reduced) return <span className={className}>{text}</span>;
  const words = text.split(' ');
  const anim = immediate ? { animate: { y: 0 } } : { whileInView: { y: 0 } };
  return (
    <span className={cn('inline', className)}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="relative inline-flex overflow-hidden py-[0.14em] leading-[0.85]"
          style={{ marginTop: '-0.14em', marginBottom: '-0.14em' }}
        >
          <motion.span
            className={cn('inline-block will-change-transform', wordClassName)}
            initial={{ y: '115%' }}
            {...anim}
            viewport={immediate ? undefined : { once: true, margin: '-8%' }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: delay + i * stagger }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? <span>&nbsp;</span> : null}
        </span>
      ))}
    </span>
  );
}

/** Paragraph whose words fade + de-blur in sequence as the block enters view. */
export function WordReveal({
  text,
  className,
  reduced,
}: {
  text: string;
  className?: string;
  reduced?: boolean;
}) {
  if (reduced) return <p className={className}>{text}</p>;
  const words = text.split(' ');
  return (
    <p className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block will-change-[filter,opacity]"
          initial={{ opacity: 0.12, filter: 'blur(4px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-12% 0px -12% 0px' }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: Math.min(i * 0.018, 0.6) }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </p>
  );
}

/** Count-up number; renders non-numeric strings verbatim. */
export function CountUp({
  value,
  className,
  reduced,
  duration = 1.3,
}: {
  value: string;
  className?: string;
  reduced?: boolean;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const [display, setDisplay] = useState(0);
  const numeric = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  const isNumber = /^\d+$/.test(value.trim());
  const suffix = value.replace(/^[\d.\s]+/, '');

  useEffect(() => {
    if (!inView || !isNumber || reduced) return;
    const controls = animate(0, numeric, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, isNumber, numeric, reduced, duration]);

  if (!isNumber) {
    return (
      <span ref={ref} className={className}>
        {value}
      </span>
    );
  }
  const shown = reduced ? numeric : display;
  return (
    <span ref={ref} className={className}>
      {Math.round(shown)}
      {suffix ? <span className="text-[0.6em]"> {suffix.trim()}</span> : null}
    </span>
  );
}

/** Infinite horizontal ticker. Static wrap when reduced. */
export function Marquee({
  items,
  reverse,
  reduced,
  className,
  itemClassName,
  markClassName,
}: {
  items: string[];
  reverse?: boolean;
  reduced?: boolean;
  className?: string;
  itemClassName?: string;
  markClassName?: string;
}) {
  if (items.length === 0) return null;
  if (reduced) {
    return (
      <div className={cn('flex flex-wrap gap-x-8 gap-y-2', className)}>
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className={itemClassName}>
            {item}
          </span>
        ))}
      </div>
    );
  }
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden">
      <div
        className={cn(
          'animate-showcase-marquee flex w-max gap-12 whitespace-nowrap',
          reverse && '[animation-direction:reverse]',
          className
        )}
      >
        {row.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className={cn('inline-flex items-center gap-12', itemClassName)}
          >
            {item}
            <span className={cn('opacity-30', markClassName)}>&#10022;</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Image that eases out of an over-scaled state on mount (Ken Burns in). */
export function KenBurns({
  src,
  alt = '',
  className,
  reduced,
  eager,
}: {
  src: string;
  alt?: string;
  className?: string;
  reduced?: boolean;
  eager?: boolean;
}) {
  return (
    <motion.img
      src={src}
      alt={alt}
      fetchPriority={eager ? 'high' : undefined}
      loading={eager ? undefined : 'lazy'}
      className={cn('size-full object-cover will-change-transform', className)}
      initial={reduced ? false : { scale: 1.16 }}
      animate={{ scale: 1 }}
      transition={{ duration: 2, ease: EASE_OUT }}
    />
  );
}

/** Scroll-linked vertical parallax for an element as it passes through the viewport. */
export function Parallax({
  children,
  className,
  amount = 60,
  reduced,
  disabled,
  embed = false,
  contained = false,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  reduced?: boolean;
  disabled?: boolean;
  /** When true, scroll is measured against the embed / preview scrollport. */
  embed?: boolean;
  contained?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const off = Boolean(disabled || reduced);
  const progress = useShowcaseScrollProgress(ref, {
    mode: 'section',
    embed,
    contained,
    enabled: !off,
    spring: { stiffness: 120, damping: 30, mass: 0.4 },
  });
  const y = useTransform(progress, [0, 1], [amount, -amount]);

  if (off) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div ref={ref} style={{ y }} className={cn('will-change-transform', className)}>
      {children}
    </motion.div>
  );
}

/** Pointer-driven 3D tilt for cards. */
export function TiltCard({
  children,
  className,
  reduced,
  max = 8,
  style,
}: {
  children: ReactNode;
  className?: string;
  reduced?: boolean;
  max?: number;
  style?: CSSProperties;
}) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 220, damping: 18 });
  const sry = useSpring(ry, { stiffness: 220, damping: 18 });

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      onPointerMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry.set(px * max * 2);
        rx.set(-py * max * 2);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900, ...style }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  );
}

/** Crossfading auto-advancing single-item stage (reviews). */
export function CrossfadeStage({
  count,
  intervalMs = 5200,
  reduced,
  render,
  className,
}: {
  count: number;
  intervalMs?: number;
  reduced?: boolean;
  render: (index: number) => ReactNode;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduced || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs, reduced]);

  if (count === 0) return null;
  if (reduced) {
    return (
      <div className={cn('space-y-10', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}>{render(i)}</div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn('relative', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={i === index ? 'relative' : 'pointer-events-none absolute inset-0'}
          initial={false}
          animate={{ opacity: i === index ? 1 : 0, y: i === index ? 0 : 12 }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
          aria-hidden={i !== index}
        >
          {render(i)}
        </motion.div>
      ))}
      {count > 1 ? (
        <div className="mt-8 flex gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show review ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === index ? 'w-8 bg-current' : 'bg-current/30 w-1.5'
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
