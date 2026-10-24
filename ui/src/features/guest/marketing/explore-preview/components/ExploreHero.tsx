import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import {
  heroSlides,
  quickDestinations,
} from '@/features/guest/marketing/explore-preview/data/explorePreviewContent';
import { EASE_OUT, rise, riseStagger } from '@/features/guest/marketing/explore-preview/lib/motion';
import { HeroSearch } from '@/features/guest/marketing/guest-landing/components/HeroSearch';

import { cn } from '@/lib/utils';

const SLIDE_MS = 6000;

export function ExploreHero() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % heroSlides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const slide = heroSlides[reduce ? 0 : active];

  return (
    <section className="relative isolate flex min-h-[86svh] w-full flex-col">
      {/* Backdrop: one photo at a time, slow cross-dissolve with a continuous push-in.
          `overflow-hidden` lives here (not on the section) so the scaled images stay
          clipped while the search dropdown can still overflow the hero. */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-slate-900">
        <AnimatePresence initial={false}>
          <motion.img
            key={slide.id}
            src={slide.image}
            alt={`A stay in ${slide.place}`}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            initial={reduce ? false : { opacity: 0, scale: 1.12 }}
            animate={
              reduce
                ? { opacity: 1 }
                : {
                    opacity: 1,
                    scale: 1,
                    transition: {
                      opacity: { duration: 1.4, ease: EASE_OUT },
                      scale: { duration: SLIDE_MS / 1000 + 1.4, ease: 'linear' },
                    },
                  }
            }
            exit={
              reduce ? undefined : { opacity: 0, transition: { duration: 1.4, ease: EASE_OUT } }
            }
          />
        </AnimatePresence>
        {/* Legibility: bottom-weighted for the console, light theme-aware veil up top for the nav. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/25 to-black/65" />
        <div className="from-background/70 absolute inset-x-0 top-0 h-36 bg-gradient-to-b to-transparent" />
      </div>

      <div className="container mx-auto flex flex-1 flex-col justify-center px-4 pb-10 pt-[calc(var(--public-nav-h)+1.5rem)] sm:pb-16 sm:pt-28 sm:px-6 lg:px-8">
        <motion.div
          variants={reduce ? undefined : riseStagger}
          initial={reduce ? false : 'hidden'}
          animate="shown"
          className="max-w-2xl"
        >
          <motion.h1
            variants={rise}
            className="public-display font-bold text-white"
          >
            Where do you want to wake up?
          </motion.h1>
          <motion.p variants={rise} className="mt-5 max-w-md text-base text-white/85 sm:text-lg">
            Verified homes across the Philippines, with real photos and secure checkout.
          </motion.p>
        </motion.div>

        <motion.div
          variants={rise}
          initial={reduce ? false : 'hidden'}
          animate="shown"
          transition={{ delay: 0.24 }}
          className="mt-9 w-full max-w-3xl sm:mt-11"
        >
          {/* z-20 so the search's own date/guest dropdown paints above the chips below it. */}
          <div className="bg-background/95 border-border/60 relative z-20 rounded-[1.4rem] border p-1.5 shadow-xl backdrop-blur-md">
            <HeroSearch />
          </div>

          <div className="relative z-10 mt-4 flex flex-wrap gap-2">
            {quickDestinations.map((destination) => (
              <button
                key={destination.query}
                type="button"
                onClick={() =>
                  navigate(`/properties?location=${encodeURIComponent(destination.query)}`)
                }
                className={cn(
                  'min-h-[40px] rounded-full border border-white/25 bg-white/10 px-4 text-sm font-medium text-white',
                  'backdrop-blur-sm transition-colors hover:bg-white/20 active:scale-[0.98]'
                )}
              >
                {destination.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
