import { useRef } from 'react';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';
import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { v3Tour } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';

/** The narrated product tour, easing up to full size as it scrolls into view. */
export function V3TourSection() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.25'] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [40, 24]);

  return (
    <section id="tour" className="bg-muted/40 scroll-mt-20 py-20 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            {v3Tour.title}
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">{v3Tour.lead}</p>
        </Reveal>

        <motion.div
          ref={ref}
          style={reduceMotion ? undefined : { scale, borderRadius: radius }}
          className="mx-auto mt-12 max-w-6xl origin-top overflow-hidden"
        >
          <HostDashboardTourPlayer variant="marketing" />
        </motion.div>
      </div>
    </section>
  );
}
