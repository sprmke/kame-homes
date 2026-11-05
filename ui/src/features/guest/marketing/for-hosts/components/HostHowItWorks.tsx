import { motion, useReducedMotion } from 'framer-motion';
import { Building2, CheckCircle2, SlidersHorizontal, Workflow } from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Add your property',
    icon: Building2,
  },
  {
    number: '02',
    title: 'Configure forms and rates',
    icon: SlidersHorizontal,
  },
  {
    number: '03',
    title: 'Run the booking workflow',
    icon: Workflow,
  },
  {
    number: '04',
    title: 'Track every stay to completion',
    icon: CheckCircle2,
  },
];

export function HostHowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="bg-muted/30 public-section-y scroll-mt-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          className="mx-auto mb-6 max-w-2xl text-center md:mb-14"
        >
          <p className="public-eyebrow text-primary mb-2.5 md:mb-3">How it works</p>
          <h2 className="text-foreground text-2xl font-bold leading-tight tracking-tight md:text-4xl">
            Set it once. Every stay follows the same path.
          </h2>
        </motion.div>

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          <div
            className="bg-border absolute left-[12.5%] right-[12.5%] top-8 hidden h-px lg:block"
            aria-hidden
          />
          {steps.map((step, index) => (
            <motion.article
              key={step.number}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: reduceMotion ? 0 : index * 0.08 }}
              className="border-border bg-card public-card-pad relative rounded-2xl border shadow-sm"
            >
              <div className="bg-primary text-primary-foreground relative z-10 mb-4 flex size-11 items-center justify-center rounded-xl shadow-md lg:mb-8 lg:size-16 lg:rounded-2xl lg:shadow-lg">
                <step.icon className="size-5 lg:size-6" aria-hidden />
              </div>
              <p className="text-primary mb-2 text-xs font-black tracking-[0.16em]">
                {step.number}
              </p>
              <h3 className="public-card-title text-foreground font-bold">{step.title}</h3>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
