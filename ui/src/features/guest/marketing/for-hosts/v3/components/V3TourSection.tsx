import { useRef } from 'react';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';
import { V3SectionHeading } from '@/features/guest/marketing/for-hosts/v3/components/V3SectionHeading';
import { v3Tour } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';

/** The narrated product tour, easing up to full size as it scrolls into view. */
export function V3TourSection() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.25'] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [40, 24]);

  return (
    <section id="tour" className="bg-muted/40 scroll-mt-20 py-10 sm:py-20 lg:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <V3SectionHeading
          eyebrow={v3Tour.eyebrow}
          title={v3Tour.title}
          lead={v3Tour.lead}
          align="center"
        />

        <motion.div
          ref={ref}
          style={reduceMotion ? undefined : { scale, borderRadius: radius }}
          className="mx-auto mt-10 max-w-6xl origin-top overflow-hidden sm:mt-12"
        >
          <HostDashboardTourPlayer variant="marketing" />
        </motion.div>
      </div>
    </section>
  );
}
