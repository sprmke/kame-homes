import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';

import {
  featuredLead,
  featuredRail,
  featuredSide,
  type FeaturedStay,
} from '@/features/guest/marketing/explore-preview/data/explorePreviewContent';
import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/explore-preview/lib/motion';

import { cn } from '@/lib/utils';

function StayCard({
  stay,
  className,
  imageClassName,
  priority,
}: {
  stay: FeaturedStay;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}) {
  return (
    <Link to={`/properties/${stay.id}`} className={cn('group block', className)}>
      <div className={cn('relative overflow-hidden rounded-3xl', imageClassName)}>
        <img
          src={stay.image}
          alt={stay.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
      <div className="mt-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground truncate font-semibold">{stay.name}</h3>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {stay.location}. Sleeps {stay.guests}.
          </p>
        </div>
        <span className="text-foreground flex shrink-0 items-center gap-1 text-sm font-medium">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
          {stay.rating.toFixed(1)}
        </span>
      </div>
      <p className="text-foreground mt-1.5 text-sm">
        <span className="font-semibold">&#8369;{stay.nightlyRate.toLocaleString()}</span>
        <span className="text-muted-foreground"> / night</span>
      </p>
    </Link>
  );
}

export function ExploreFeaturedStays() {
  const reduce = useReducedMotion();

  return (
    <section className="bg-background public-section-y">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={reduce ? undefined : rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="flex items-end justify-between gap-4"
        >
          <h2 className="text-foreground public-section-title font-bold">
            Stays guests are booking now
          </h2>
          <Link
            to="/properties"
            className="text-foreground hover:text-primary group hidden shrink-0 items-center gap-1.5 text-sm font-medium sm:flex"
          >
            All stays
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </motion.div>

        <motion.div
          variants={reduce ? undefined : riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="mt-8 grid gap-5 lg:grid-cols-12"
        >
          <motion.div variants={reduce ? undefined : rise} className="lg:col-span-7">
            <StayCard
              stay={featuredLead}
              priority
              imageClassName="aspect-[4/5] sm:aspect-[16/11] lg:aspect-auto lg:h-[560px]"
            />
          </motion.div>

          <div className="flex flex-col gap-5 lg:col-span-5">
            {featuredSide.map((stay) => (
              <motion.div key={stay.id} variants={reduce ? undefined : rise}>
                <StayCard stay={stay} imageClassName="aspect-[16/10] lg:aspect-auto lg:h-[270px]" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Breadth without a longer column: the rest run as a flick-through rail. */}
      <div className="mt-6 lg:mt-8">
        <div className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8">
          {featuredRail.map((stay) => (
            <StayCard
              key={stay.id}
              stay={stay}
              className="w-[248px] shrink-0 snap-start sm:w-[268px]"
              imageClassName="aspect-[4/3]"
            />
          ))}
          <Link
            to="/properties"
            className="border-border text-muted-foreground hover:border-primary/50 hover:text-foreground flex w-[248px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-3xl border border-dashed text-sm font-medium transition-colors sm:w-[268px]"
          >
            <ArrowRight className="h-5 w-5" aria-hidden />
            All stays
          </Link>
        </div>
      </div>
    </section>
  );
}
