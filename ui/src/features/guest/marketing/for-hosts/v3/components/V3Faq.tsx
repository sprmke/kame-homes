import { useId, useState } from 'react';

import { Link } from 'react-router-dom';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { v3Faq } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';

import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const panelId = useId();

  return (
    <div className="border-border border-b">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="text-foreground flex min-h-[64px] w-full items-center justify-between gap-6 py-4 text-left text-base font-semibold sm:text-lg"
        >
          {question}
          <span
            className={cn(
              'border-border flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-300',
              open && 'border-primary bg-primary rotate-45 text-white'
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="text-muted-foreground max-w-2xl pb-5 leading-relaxed">{answer}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function V3Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-24 lg:py-32">
      <div className="container mx-auto grid gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-primary text-sm font-semibold">{v3Faq.eyebrow}</p>
          <h2 className="text-foreground mt-3 text-balance text-3xl font-bold tracking-[-0.025em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
            {v3Faq.title}
          </h2>
          <Link
            to={v3Faq.contact.to}
            className="text-primary group mt-6 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold"
          >
            {v3Faq.contact.label}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="border-border border-t">
          {v3Faq.items.map((item, index) => (
            <FaqItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              open={openIndex === index}
              onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
