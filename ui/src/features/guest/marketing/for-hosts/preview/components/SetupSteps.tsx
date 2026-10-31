import { motion, useReducedMotion } from 'framer-motion';

import { Eyebrow } from '@/features/guest/marketing/for-hosts/preview/components/Eyebrow';
import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { setupContent } from '@/features/guest/marketing/for-hosts/preview/data/hostShowcase';

const { eyebrow, title, lead, steps } = setupContent;

export function SetupSteps() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">{lead}</p>
        </Reveal>

        <div className="relative mt-14 grid gap-8 lg:grid-cols-4 lg:gap-6">
          <span
            aria-hidden
            className="bg-border absolute left-0 right-0 top-[9px] hidden h-px lg:block"
          />
          <motion.span
            aria-hidden
            className="bg-primary absolute left-0 top-[9px] hidden h-px origin-left lg:block"
            style={{ right: 0 }}
            initial={reduceMotion ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
          />

          {steps.map((step, index) => (
            <motion.div
              key={step.step}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{
                duration: reduceMotion ? 0 : 0.5,
                delay: reduceMotion ? 0 : 0.12 * index + 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative pl-6 lg:pl-0"
            >
              <span aria-hidden className="bg-border absolute left-0 top-0 h-full w-px lg:hidden" />
              <span
                aria-hidden
                className="border-background bg-primary absolute left-[-4px] top-1 h-[18px] w-[18px] rounded-full border-4 lg:left-0"
              />
              <p className="text-primary text-2xl font-extrabold tabular-nums tracking-tight lg:mt-8">
                {step.step}
              </p>
              <h3 className="text-foreground mt-3 text-lg font-bold">{step.title}</h3>
              <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
