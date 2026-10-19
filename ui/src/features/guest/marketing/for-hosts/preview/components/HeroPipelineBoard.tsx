import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The hero's anchor visual: one real booking travelling down the six-stage workflow. The teal
 * thread on the spine is the page's signature — it marks the stages Kame handles on its own.
 */

const stages = [
  { status: 'Pending review', label: 'New booking', done: true },
  { status: 'Pending documents', label: 'Documents', done: true, needsYou: true },
  { status: 'Ready for check-in', label: 'Ready to check in', done: true, current: true },
  { status: 'Ready for check-out', label: 'Staying', done: false },
  { status: 'Pending SD refund', label: 'Deposit refund', done: false },
  { status: 'Completed', label: 'Closed', done: false },
];

const autoLog = [
  'GAF + pet documents cleared by email',
  'Deposit receipt checked by AI',
  'Calendar + Airbnb updated · stay guide sent',
];

export function HeroPipelineBoard() {
  const reduceMotion = useReducedMotion();
  const currentIndex = stages.findIndex((stage) => stage.current);
  const fillRatio = currentIndex / (stages.length - 1);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24, rotate: 3 }}
      animate={{ opacity: 1, y: 0, rotate: reduceMotion ? 0 : 1.4 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : 0.15 }}
      className="relative"
    >
      <div
        aria-hidden
        className="bg-primary/10 absolute -inset-5 -z-10 rounded-[2.5rem] blur-2xl"
      />
      <div className="border-border bg-card rounded-3xl border p-5 shadow-[0_32px_70px_-28px_hsl(var(--shadow-color)/0.3)] sm:p-6">
        {/* Booking header */}
        <div className="flex items-center gap-3">
          <span className="bg-primary-strong text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
            M
          </span>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-bold">Maria Santos</p>
            <p className="text-muted-foreground text-xs">Nov 12–15 · 2 guests · Tagaytay</p>
          </div>
          <span className="bg-primary/10 text-primary ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold">
            Ready to check in
          </span>
        </div>

        {/* Spine */}
        <ol className="relative mt-6 space-y-3.5 pl-6">
          <span
            aria-hidden
            className="bg-border absolute bottom-2 left-[7px] top-2 w-0.5 rounded-full"
          />
          <motion.span
            aria-hidden
            className="bg-primary absolute left-[7px] top-2 w-0.5 origin-top rounded-full"
            style={{ height: `calc((100% - 1rem) * ${fillRatio})` }}
            initial={reduceMotion ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
          />
          {stages.map((stage) => (
            <li key={stage.status} className="relative">
              <span
                className={cn(
                  'absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2',
                  stage.done ? 'border-primary bg-primary' : 'border-border bg-card'
                )}
              >
                {stage.done && !stage.current ? (
                  <Check className="text-primary-foreground h-2.5 w-2.5" aria-hidden />
                ) : null}
                {stage.needsYou ? (
                  <span
                    className="bg-warning absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-[hsl(var(--card))]"
                    aria-hidden
                  />
                ) : null}
              </span>
              <p
                className={cn(
                  'text-[11px] font-semibold',
                  stage.current ? 'text-primary' : 'text-muted-foreground/70'
                )}
              >
                {stage.status}
              </p>
              <p
                className={cn(
                  'text-[13px] font-semibold',
                  stage.done ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {stage.label}
                {stage.needsYou ? (
                  <span className="text-warning-foreground ml-2 text-[11px] font-semibold">
                    needs you
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ol>

        {/* Automated log */}
        <ul className="border-border mt-5 space-y-2 border-t pt-4">
          {autoLog.map((entry) => (
            <li key={entry} className="flex items-center gap-2.5 text-[13px]">
              <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                <Check className="h-3 w-3" aria-hidden />
              </span>
              <span className="text-muted-foreground">{entry}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground/70 mt-4 text-[11px]">
          Handled in the background while you were away
        </p>
      </div>
    </motion.div>
  );
}
