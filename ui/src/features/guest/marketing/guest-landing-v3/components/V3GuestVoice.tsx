import { useEffect, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Quote } from 'lucide-react';

import {
  guestQuotes,
  guestVoiceCopy,
} from '@/features/guest/marketing/guest-landing-v3/data/landingV3Content';
import {
  EASE_OUT,
  inViewOnce,
  rise,
} from '@/features/guest/marketing/guest-landing-v3/lib/quietMotion';

import { cn } from '@/lib/utils';

const AUTOPLAY_MS = 7000;

/**
 * One large pull-quote that cross-fades to the next. No card, no flip, no rotation — the
 * quiet opposite of the first attempt's page-turn, which read as a UI trick rather than a
 * voice. Sample content until real reviews exist; said so on the page, not just in code.
 */
export function V3GuestVoice() {
  const reduce = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const quote = guestQuotes[index];

  useEffect(() => {
    if (reduce || guestQuotes.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % guestQuotes.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <section aria-labelledby="v3-voice-title" className="public-section-y bg-background">
      <div className="container mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        <motion.p
          id="v3-voice-title"
          variants={rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-primary text-xs font-semibold uppercase tracking-[0.18em]"
        >
          {guestVoiceCopy.eyebrow}
        </motion.p>

        <Quote className="text-primary/25 mx-auto mt-5 size-8" aria-hidden />

        <div className="relative mt-4 min-h-[7rem] sm:min-h-[6rem]">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={index}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              <p className="text-foreground text-balance text-xl font-medium leading-snug tracking-tight sm:text-2xl">
                {quote.quote}
              </p>
              <footer className="text-muted-foreground mt-4 text-sm">
                {quote.name} · {quote.stay}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        {guestQuotes.length > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-2">
            {guestQuotes.map((item, i) => (
              <button
                key={item.name}
                type="button"
                aria-label={`Show review ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className="flex size-11 items-center justify-center"
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full transition-colors',
                    i === index ? 'bg-primary' : 'bg-border'
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}

        <p className="text-muted-foreground mt-2 text-xs">{guestVoiceCopy.sampleNotice}</p>
      </div>
    </section>
  );
}
