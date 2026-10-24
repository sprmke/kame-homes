import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { inViewOnce, rise } from '@/features/guest/marketing/explore-preview/lib/motion';

export function ExploreClosingCta() {
  const reduce = useReducedMotion();

  return (
    <section className="bg-background pb-20 lg:pb-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={reduce ? undefined : rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="gradient-primary relative overflow-hidden rounded-[2rem] px-4 py-8 text-center sm:px-12 sm:py-20"
        >
          <h2 className="mx-auto max-w-2xl public-section-title font-bold text-white">
            Your next stay is a search away
          </h2>
          <p className="mx-auto mt-4 max-w-md text-white/85">
            Browse verified homes across the Philippines and book in a few minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/properties"
              className="text-primary inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Browse all stays
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/for-hosts"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/60 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              List your place
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
