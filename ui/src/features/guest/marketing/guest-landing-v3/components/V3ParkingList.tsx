import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CarFront } from 'lucide-react';

import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v3/lib/quietMotion';
import { usePublicParkings } from '@/features/guest/marketing/parkings/hooks/usePublicParkings';
import {
  DEFAULT_PARKINGS_QUERY,
  type PublicParkingListItem,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';

import { Button } from '@/components/ui/button';

const PARKING_QUERY = { ...DEFAULT_PARKINGS_QUERY, page: 1, pageSize: 3 };

const SLOT_TYPE_LABEL: Record<string, string> = {
  inside_tower: 'Inside tower',
  outside_tower: 'Outside tower',
  motorcycle: 'Motorcycle',
};

/** Parking is its own vertical. Plain, quiet cards — no ticket-stub novelty, just the facts. */
export function V3ParkingList() {
  const reduce = useReducedMotion() ?? false;
  const query = usePublicParkings(PARKING_QUERY);
  const slots = query.data?.data ?? [];
  const fromRate = query.data?.facets.price.min ?? 0;

  if (query.isLoading || slots.length === 0) return null;

  return (
    <section aria-labelledby="v3-parking-title" className="public-section-y bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div>
            <motion.h2
              id="v3-parking-title"
              variants={rise}
              className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
            >
              Driving in? Park where you sleep.
            </motion.h2>
            <motion.p variants={rise} className="text-muted-foreground mt-2 max-w-md">
              Book a slot by the night in the same building.
              {fromRate > 0 ? ` From ₱${fromRate.toLocaleString()}.` : ''}
            </motion.p>
          </div>
          <motion.div variants={rise}>
            <Button variant="outline" className="rounded-full" asChild>
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
          className="mt-8 grid gap-3 sm:grid-cols-3"
        >
          {slots.map((slot) => (
            <motion.li key={slot.id} variants={rise}>
              <ParkingCard slot={slot} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

function ParkingCard({ slot }: { slot: PublicParkingListItem }) {
  return (
    <Link
      to={`/parkings/${slot.slug}`}
      className="focus-visible:ring-ring border-border bg-card hover:border-foreground/20 group block rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-2.5">
        <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full">
          <CarFront className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-semibold">
            {slot.tower ? `${slot.tower} tower` : (slot.developmentName ?? 'Parking')}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {SLOT_TYPE_LABEL[slot.parkingType] ?? 'Slot'} · Level {slot.level ?? '-'} · Slot{' '}
            {slot.slotLabel}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-foreground text-base font-semibold tabular-nums">
          ₱{slot.ratePerNight.toLocaleString()}
          <span className="text-muted-foreground text-sm font-normal"> a night</span>
        </span>
        <ArrowRight
          className="text-muted-foreground group-hover:text-primary size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}
