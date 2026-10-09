import { useRef } from 'react';

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';

import { v3Replace } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';

const { intro, tools, outro } = v3Replace;
/** Tools share the first 80% of the scroll range; the outro resolves in the last 20%. */
const TOOLS_SPAN = 0.8;

function StruckTool({
  label,
  index,
  progress,
  reduceMotion,
}: {
  label: string;
  index: number;
  progress: MotionValue<number>;
  reduceMotion: boolean;
}) {
  const start = (index / tools.length) * TOOLS_SPAN;
  const end = ((index + 1) / tools.length) * TOOLS_SPAN;
  // A background-gradient strike (not a positioned bar) so the line follows the text when it
  // wraps on phones; with the default `slice` decoration it draws across both lines in order.
  const strikeSize = useTransform(progress, [start, end], ['0% 0.075em', '100% 0.075em']);
  const opacity = useTransform(progress, [start, end], [1, 0.38]);

  return (
    <motion.span
      className="bg-no-repeat [background-image:linear-gradient(hsl(var(--primary)),hsl(var(--primary)))] [background-position:0_58%]"
      style={
        reduceMotion
          ? { opacity: 0.38, backgroundSize: '100% 0.075em' }
          : { opacity, backgroundSize: strikeSize }
      }
    >
      {label}
    </motion.span>
  );
}

/**
 * Editorial statement: the scattered tools a host juggles get struck through one by one as the
 * section scrolls past, then the one-card promise resolves. Scroll-linked, so it reads at the
 * visitor's own pace; static (all struck) under reduced motion.
 */
export function V3ReplaceStatement() {
  const reduceMotion = Boolean(useReducedMotion());
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.6'] });
  const outroOpacity = useTransform(scrollYProgress, [TOOLS_SPAN, 1], [0, 1]);
  const outroY = useTransform(scrollYProgress, [TOOLS_SPAN, 1], [24, 0]);

  return (
    <section ref={ref} aria-label="Why hosts switch" className="py-20 sm:py-28 lg:py-36">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-foreground mx-auto max-w-4xl text-[clamp(1.75rem,4.4vw,3.25rem)] font-bold leading-[1.18] tracking-[-0.025em]">
          <span className="text-muted-foreground">{intro} </span>
          {tools.map((tool, index) => (
            <span key={tool}>
              <StruckTool
                label={tool}
                index={index}
                progress={scrollYProgress}
                reduceMotion={reduceMotion}
              />{' '}
            </span>
          ))}
        </p>
        <motion.p
          className="text-primary mx-auto mt-6 max-w-4xl text-[clamp(1.75rem,4.4vw,3.25rem)] font-bold leading-[1.18] tracking-[-0.025em] sm:mt-8"
          style={reduceMotion ? undefined : { opacity: outroOpacity, y: outroY }}
        >
          {outro}
        </motion.p>
      </div>
    </section>
  );
}
