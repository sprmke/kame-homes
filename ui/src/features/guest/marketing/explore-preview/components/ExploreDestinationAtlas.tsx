import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

import {
  atlasEntries,
  type AtlasEntry,
} from '@/features/guest/marketing/explore-preview/data/explorePreviewContent';
import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/explore-preview/lib/motion';

import { cn } from '@/lib/utils';

function AtlasTile({ entry, large }: { entry: AtlasEntry; large?: boolean }) {
  return (
    <Link
      to={`/properties?location=${encodeURIComponent(entry.query)}`}
      className="group relative block h-full overflow-hidden rounded-3xl"
    >
      <img
        src={entry.image}
        alt={entry.name}
        loading="lazy"
        decoding="async"
        className={cn(
          'w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105',
          large ? 'aspect-[4/3] lg:aspect-auto lg:h-full' : 'aspect-[16/10] lg:aspect-[5/4]'
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0">
          <h3 className={cn('font-bold text-white', large ? 'text-2xl sm:text-3xl' : 'text-lg')}>
            {entry.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-white/80">{entry.blurb}</p>
          <p className="mt-1.5 text-xs font-medium uppercase tracking-wide text-white/65">
            {entry.stays} stays
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-sm transition-colors group-hover:bg-white/25 sm:h-11 sm:w-11">
          <ArrowUpRight className="h-5 w-5 text-white" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export function ExploreDestinationAtlas() {
  const reduce = useReducedMotion();

  return (
    <section className="bg-muted/40 public-section-y">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={reduce ? undefined : rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="max-w-xl"
        >
          <h2 className="text-foreground public-section-title font-bold">
            Where to next
          </h2>
          <p className="text-muted-foreground mt-3">
            From island beachfronts to city lofts. Pick a place and see what is open for your dates.
          </p>
        </motion.div>

        <motion.div
          variants={reduce ? undefined : riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[1fr] lg:grid-cols-4 lg:gap-5"
        >
          {atlasEntries.map((entry, index) => (
            <motion.div
              key={entry.id}
              variants={reduce ? undefined : rise}
              className={cn(index === 0 && 'sm:col-span-2 lg:row-span-2')}
            >
              <AtlasTile entry={entry} large={index === 0} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
