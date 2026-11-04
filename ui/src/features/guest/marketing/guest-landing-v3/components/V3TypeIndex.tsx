import { useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

import {
  EASE_OUT,
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v3/lib/quietMotion';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import type { PublicListingFamily } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';
import { usePublicPlaceGroups } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';
import {
  resolveListingImages,
  type ListingImageKind,
} from '@/features/guest/marketing/shared/lib/mockListingImages';

import { Skeleton } from '@/components/ui/skeleton';

const ROW_LIMIT = 6;

type Row = { slug: string; place: string; total: number; image: string };

/**
 * One type-as-navigation index, reused for both "Browse by place" and "The buildings
 * behind the stays" so the page has a single confident device instead of two different
 * novelty ones. On pointer devices the row under the cursor pulls a photo preview with it.
 */
export function V3TypeIndex({
  headingId,
  heading,
  family,
  imageKind,
  basePath,
  unitNoun,
}: {
  headingId: string;
  heading: string;
  family: PublicListingFamily;
  imageKind: ListingImageKind;
  basePath: string;
  unitNoun: (total: number) => string;
}) {
  const reduce = useReducedMotion() ?? false;
  const query = usePublicPlaceGroups<{ images?: string[] }>(family, true, ROW_LIMIT, 1);
  const rows: Row[] = (query.data?.pages[0]?.groups ?? []).map((group) => ({
    slug: group.locationSlug,
    place: group.place,
    total: group.total,
    image: resolveListingImages(group.preview[0]?.images, imageKind, group.locationSlug)[0] ?? '',
  }));

  const listRef = useRef<HTMLUListElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const y = useMotionValue(0);
  const springY = useSpring(y, { stiffness: 260, damping: 30, mass: 0.6 });

  if (!query.isLoading && rows.length === 0) return null;

  const onPointerMove = (event: React.PointerEvent) => {
    const box = listRef.current?.getBoundingClientRect();
    if (!box) return;
    const next = event.clientY - box.top;
    if (hovered == null) springY.jump(next);
    y.set(next);
  };

  const preview = hovered != null ? rows[hovered] : null;

  return (
    <section aria-labelledby={headingId} className="public-section-y bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          id={headingId}
          variants={rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
        >
          {heading}
        </motion.h2>

        {query.isLoading ? (
          <div className="mt-6 space-y-4" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl md:h-20" />
            ))}
          </div>
        ) : (
          <motion.ul
            ref={listRef}
            variants={riseStagger}
            initial={reduce ? false : 'hidden'}
            whileInView="shown"
            viewport={inViewOnce}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHovered(null)}
            className="border-border relative mt-6 border-t"
          >
            {rows.map((row, index) => (
              <motion.li key={row.slug} variants={rise} className="border-border border-b">
                <Link
                  to={`${basePath}/${row.slug}`}
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') setHovered(index);
                  }}
                  onFocus={() => setHovered(null)}
                  className="focus-visible:ring-ring group flex items-center gap-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 md:gap-6 md:py-5"
                >
                  <span className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-lg md:hidden">
                    <Image src={row.image} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <span className="text-foreground group-hover:text-primary min-w-0 flex-1 truncate text-xl font-semibold tracking-tight transition-colors md:text-3xl lg:text-4xl">
                    {row.place}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                    {unitNoun(row.total)}
                  </span>
                  <ArrowUpRight
                    className="text-foreground group-hover:text-primary size-4 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 md:size-5"
                    aria-hidden
                  />
                </Link>
              </motion.li>
            ))}

            <AnimatePresence>
              {preview && !reduce ? (
                <motion.div
                  key="preview"
                  aria-hidden
                  className="pointer-events-none absolute left-[62%] top-0 z-10 hidden md:block"
                  style={{ y: springY }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                  <div className="relative -ml-24 -mt-[5.5rem] h-44 w-48 overflow-hidden rounded-2xl shadow-[0_24px_48px_-24px_rgb(15_23_42/0.5)] lg:-ml-28 lg:-mt-24 lg:h-52 lg:w-56">
                    <Image src={preview.image} alt="" fill sizes="224px" className="object-cover" />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </section>
  );
}
