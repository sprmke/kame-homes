import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v2/lib/apertureMotion';
import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  DEFAULT_PARKINGS_QUERY,
  type PublicParkingListItem,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PARKING_QUERY = { ...DEFAULT_PARKINGS_QUERY, page: 1, pageSize: 3 };

const SLOT_TYPE_LABEL: Record<string, string> = {
  inside_tower: 'Inside tower',
  outside_tower: 'Outside tower',
  motorcycle: 'Motorcycle',
};

/** Parking is its own vertical: live slots drawn as ticket stubs, with the real lowest rate. */
export function V2ParkingBand() {
  const reduce = useReducedMotion() ?? false;
  const query = usePublicParkings(PARKING_QUERY);
  const slots = query.data?.data ?? [];
  const fromRate = query.data?.facets.price.min ?? 0;

  if (query.isLoading || slots.length === 0) return null;

  return (
    <section aria-labelledby="v2-parking-title" className="public-section-y bg-background">
      <div className="container mx-auto grid gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:px-8">
        <motion.div
          variants={riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
        >
          <motion.h2
            id="v2-parking-title"
            variants={rise}
            className="text-foreground max-w-[14ch] text-balance text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] md:text-4xl lg:text-5xl"
          >
            Driving in? Park where you sleep.
          </motion.h2>
          <motion.p variants={rise} className="public-lead text-muted-foreground mt-3 max-w-md">
            Book a slot by the night in the same building.
            {fromRate > 0 ? ` From ₱${fromRate.toLocaleString()}.` : ''}
          </motion.p>
          <motion.div variants={rise} className="mt-6">
            <Button className="public-cta rounded-full" asChild>
              <Link to="/parkings">
                Find parking
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        <motion.ul
          variants={riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="grid gap-3 sm:grid-cols-3 lg:gap-4"
        >
          {slots.map((slot, index) => (
            <motion.li
              key={slot.id}
              variants={rise}
              className={cn(index === 1 && 'sm:mt-6', index === 2 && 'hidden sm:mt-12 sm:block')}
            >
              <ParkingTicket slot={slot} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function ParkingTicket({ slot }: { slot: PublicParkingListItem }) {
  return (
    <Link
      to={`/parkings/${slot.slug}`}
      className="focus-visible:ring-ring group block rounded-[1.25rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
    >
      <div className="border-border bg-card relative overflow-hidden rounded-[1.25rem] border transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_24px_40px_-24px_rgb(15_23_42/0.4)]">
        <div className="bg-primary-strong text-primary-foreground flex items-center justify-between gap-2 px-4 py-3">
          <span className="truncate text-sm font-semibold">
            {slot.tower ? `${slot.tower} tower` : (slot.developmentName ?? 'Parking')}
          </span>
          <span className="shrink-0 text-xs opacity-85">
            {SLOT_TYPE_LABEL[slot.parkingType] ?? 'Slot'}
          </span>
        </div>

        <div className="grid grid-cols-2">
          <TicketField label="Level" value={slot.level ?? '-'} />
          <TicketField label="Slot" value={slot.slotLabel} />
        </div>

        {/* Perforation: punched notches + a dashed tear line. */}
        <div className="relative h-0" aria-hidden>
          <span className="bg-background border-border absolute -left-2.5 -top-2.5 size-5 rounded-full border" />
          <span className="bg-background border-border absolute -right-2.5 -top-2.5 size-5 rounded-full border" />
          <span className="border-border absolute inset-x-4 top-0 border-t border-dashed" />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-foreground text-sm font-semibold tabular-nums">
            ₱{slot.ratePerNight.toLocaleString()}
            <span className="text-muted-foreground font-normal"> a night</span>
          </span>
          <ArrowRight
            className="text-muted-foreground group-hover:text-primary size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}

function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div className="first:border-border px-4 py-3 first:border-r">
      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="text-foreground mt-0.5 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
