import { useRef } from 'react';

import { Link } from 'react-router-dom';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import {
  V3_PRICING_CTA,
  V3_SIGNUP_CTA,
  v3Closing,
  v3Images,
} from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';

/** Photo-backed closing panel. Graphite scrim keeps white text readable without green-on-green. */
export function V3ClosingCta() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.12, 1]);

  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
      <div
        ref={ref}
        className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-zinc-900"
      >
        <motion.div
          className="absolute inset-0"
          style={reduceMotion ? undefined : { scale: imageScale }}
        >
          <MarketingImage
            src={v3Images.closing}
            alt={v3Closing.imageAlt}
            fill
            className="object-cover"
          />
        </motion.div>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-zinc-950/85 via-zinc-950/60 to-zinc-950/20"
        />

        <Reveal className="relative px-4 py-10 sm:px-12 sm:py-20 lg:px-16 lg:py-28">
          <h2 className="max-w-xl text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            {v3Closing.title}
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
            {v3Closing.body}
          </p>
          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="group min-h-[52px] rounded-full px-7 text-base font-semibold text-white transition-transform active:scale-[0.98]"
            >
              <Link to={V3_SIGNUP_CTA.to}>
                {V3_SIGNUP_CTA.label}
                <ArrowRight
                  className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-[52px] rounded-full border-white/30 bg-white/10 px-7 text-base text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
            >
              <Link to={V3_PRICING_CTA.to}>{V3_PRICING_CTA.label}</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
