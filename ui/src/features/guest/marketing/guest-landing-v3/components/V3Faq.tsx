import { motion, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';

import {
  faqCopy,
  faqItems,
} from '@/features/guest/marketing/guest-landing-v3/data/landingV3Content';
import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v3/lib/quietMotion';

/** Small, native `<details>` disclosures — no accordion dependency needed for 4 answers. */
export function V3Faq() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section aria-labelledby="v3-faq-title" className="public-section-y bg-muted/30">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <motion.p
          variants={rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-primary text-xs font-semibold uppercase tracking-[0.18em]"
        >
          {faqCopy.eyebrow}
        </motion.p>
        <motion.h2
          id="v3-faq-title"
          variants={rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-foreground mt-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
        >
          {faqCopy.headline}
        </motion.h2>

        <motion.div
          variants={riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="border-border divide-border mt-8 divide-y border-t"
        >
          {faqItems.map((item) => (
            <motion.details key={item.question} variants={rise} className="group py-4">
              <summary className="focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded focus-visible:outline-none focus-visible:ring-2">
                <span className="public-card-title text-foreground font-semibold">
                  {item.question}
                </span>
                <Plus
                  className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-45"
                  aria-hidden
                />
              </summary>
              <p className="text-muted-foreground mt-2 max-w-prose text-sm">{item.answer}</p>
            </motion.details>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
