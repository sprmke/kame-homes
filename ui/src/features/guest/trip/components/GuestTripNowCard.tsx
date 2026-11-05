import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight, Copy, Gift } from 'lucide-react';
import { toast } from 'sonner';

import { GuestTripSmartLink } from '@/features/guest/trip/components/GuestTripSmartLink';
import { GuestTripStatusPill } from '@/features/guest/trip/components/GuestTripStatusPill';
import type { GuestTripActionLink } from '@/features/guest/trip/lib/guestTripLinks';
import {
  GUEST_TRIP_STEPS,
  type GuestTripChecklistItem,
  type GuestTripHeadline,
} from '@/features/guest/trip/lib/guestTripPhase';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Five segments; done ones fill left to right once on arrival (static under reduced motion). */
function ProgressSegments({ done, active }: { done: number; active: number }) {
  const reduceMotion = useReducedMotion();
  const current = active >= 0 ? GUEST_TRIP_STEPS[active] : null;
  const caption =
    done >= GUEST_TRIP_STEPS.length
      ? 'All steps done'
      : current
        ? `Step ${active + 1} of ${GUEST_TRIP_STEPS.length} · ${current}`
        : null;

  return (
    <div>
      <div
        className="flex gap-1.5"
        role="img"
        aria-label={caption ? `Booking progress: ${caption}` : 'Booking progress'}
      >
        {GUEST_TRIP_STEPS.map((step, index) => {
          const filled = index < done;
          const isActive = index === active;
          return (
            <span
              key={step}
              className="bg-foreground/10 relative h-1.5 flex-1 overflow-hidden rounded-full"
            >
              {filled || isActive ? (
                <motion.span
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full',
                    filled ? 'bg-primary w-full' : 'bg-primary/45 w-1/2'
                  )}
                  style={{ originX: 0 }}
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.5,
                    delay: reduceMotion ? 0 : 0.08 * index,
                    ease: EASE_OUT,
                  }}
                />
              ) : null}
            </span>
          );
        })}
      </div>
      {caption ? <p className="text-muted-foreground mt-2 text-xs">{caption}</p> : null}
    </div>
  );
}

function ChecklistRow({ item, index }: { item: GuestTripChecklistItem; index: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.3,
        delay: reduceMotion ? 0 : 0.35 + index * 0.06,
        ease: EASE_OUT,
      }}
    >
      <GuestTripSmartLink
        to={item.href}
        className="hover:bg-foreground/[0.04] focus-visible:ring-ring -mx-2 flex min-h-[44px] items-center gap-3 rounded-xl px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full',
            item.done
              ? 'bg-foreground text-background'
              : 'border-foreground/30 border-[1.5px] border-dashed'
          )}
          aria-hidden
        >
          {item.done ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
        <span className={cn('min-w-0 flex-1', item.done ? 'text-muted-foreground' : 'font-medium')}>
          <span className="sr-only">{item.done ? 'Done: ' : 'To do: '}</span>
          {item.label}
        </span>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </GuestTripSmartLink>
    </motion.li>
  );
}

async function copyVoucher(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast.success('Voucher code copied');
  } catch {
    toast.error('Could not copy');
  }
}

/**
 * The one filled block on the page: where the trip stands today and the single thing to do.
 * Everything else on the page is reference.
 */
export function GuestTripNowCard({
  headline,
  progress,
  checklist,
  primary,
  secondary,
  voucher,
}: {
  headline: GuestTripHeadline;
  progress: { done: number; active: number };
  checklist: GuestTripChecklistItem[];
  primary: GuestTripActionLink;
  secondary?: GuestTripActionLink | null;
  voucher?: { code: string; redeemed: boolean } | null;
}) {
  const showProgress = progress.done > 0 || progress.active >= 0;

  return (
    <section
      aria-labelledby="trip-now-title"
      className="border-primary/15 bg-primary/[0.06] rounded-3xl border p-5 sm:p-6"
    >
      <GuestTripStatusPill label={headline.kicker} tone={headline.tone} />
      <h2
        id="trip-now-title"
        className="mt-2.5 text-balance text-xl font-bold leading-tight tracking-tight md:mt-3 md:text-2xl"
      >
        {headline.title}
      </h2>
      {headline.body ? (
        <p className="text-foreground/75 mt-1.5 text-sm leading-relaxed">{headline.body}</p>
      ) : null}

      {showProgress ? (
        <div className="mt-5">
          <ProgressSegments done={progress.done} active={progress.active} />
        </div>
      ) : null}

      {checklist.length > 0 ? (
        <ul className="mt-4 space-y-0.5" aria-label="Before your stay">
          {checklist.map((item, index) => (
            <ChecklistRow key={item.key} item={item} index={index} />
          ))}
        </ul>
      ) : null}

      {voucher && !voucher.redeemed ? (
        <div className="border-primary/30 bg-background/70 mt-5 flex items-center gap-3 rounded-2xl border border-dashed p-3">
          <Gift className="text-foreground/70 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">Voucher for your next stay</p>
            <p className="truncate font-mono text-sm font-bold tracking-wide">{voucher.code}</p>
          </div>
          <button
            type="button"
            onClick={() => void copyVoucher(voucher.code)}
            className="text-muted-foreground hover:text-foreground flex size-11 shrink-0 items-center justify-center rounded-xl"
            aria-label={`Copy voucher code ${voucher.code}`}
          >
            <Copy className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        {primary.to ? (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <GuestTripSmartLink to={primary.to}>
              <primary.Icon aria-hidden />
              {primary.label}
            </GuestTripSmartLink>
          </Button>
        ) : null}
        {secondary?.to ? (
          <Button asChild variant="ghost" className="min-h-[44px] w-full sm:w-auto">
            <GuestTripSmartLink to={secondary.to}>{secondary.label}</GuestTripSmartLink>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
