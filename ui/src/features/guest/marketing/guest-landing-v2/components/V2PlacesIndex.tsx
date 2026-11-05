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
} from '@/features/guest/marketing/guest-landing-v2/lib/apertureMotion';
import type { PublicPropertyListItem } from '@/features/guest/marketing/properties/lib/propertiesQuery';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import { usePublicPlaceGroups } from '@/features/guest/marketing/shared/hooks/usePublicPlaceGroups';
import { resolveListingImages } from '@/features/guest/marketing/shared/lib/mockListingImages';

import { Skeleton } from '@/components/ui/skeleton';

const PLACE_LIMIT = 6;

type PlaceRow = { slug: string; place: string; total: number; image: string };

/**
 * Where the stays are, from live place groups. A big type index: on pointer devices the
 * row you hover pulls a photo of that place along with the cursor; phones get a thumbnail.
 */
export function V2PlacesIndex() {
  const reduce = useReducedMotion() ?? false;
  const query = usePublicPlaceGroups<PublicPropertyListItem>('properties', true, PLACE_LIMIT, 1);
  const rows: PlaceRow[] = (query.data?.pages[0]?.groups ?? []).map((group) => ({
    slug: group.locationSlug,
    place: group.place,
    total: group.total,
    image: resolveListingImages(group.preview[0]?.images, 'property', group.locationSlug)[0] ?? '',
  }));

  const listRef = useRef<HTMLUListElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  // The preview holds a fixed column in the row's empty middle and only follows the cursor
  // vertically, so it never covers the place name it illustrates.
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
    <section aria-labelledby="v2-places-title" className="public-section-y bg-muted/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          id="v2-places-title"
          variants={rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-foreground text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] md:text-4xl lg:text-5xl"
        >
          Browse by place
        </motion.h2>

        {query.isLoading ? (
          <div className="mt-8 space-y-4" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl md:h-24" />
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
            className="border-border relative mt-6 border-t md:mt-10"
          >
            {rows.map((row, index) => (
              <motion.li key={row.slug} variants={rise} className="border-border border-b">
                <Link
                  to={`/properties/in/${row.slug}`}
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') setHovered(index);
                  }}
                  onFocus={() => setHovered(null)}
                  className="focus-visible:ring-ring group flex items-center gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 md:gap-6 md:py-7"
                >
                  <span className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-xl md:hidden">
                    <Image src={row.image} alt="" fill sizes="56px" className="object-cover" />
                  </span>
                  <span className="text-foreground group-hover:text-primary min-w-0 flex-1 truncate text-2xl font-bold tracking-[-0.03em] transition-colors md:text-5xl lg:text-6xl">
                    {row.place}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-sm tabular-nums md:text-base">
                    {row.total} {row.total === 1 ? 'stay' : 'stays'}
                  </span>
                  <ArrowUpRight
                    className="text-foreground group-hover:text-primary size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 md:size-7"
                    aria-hidden
                  />
                </Link>
              </motion.li>
            ))}

            {/* Cursor-following preview (fine pointers only; hidden from AT). */}
            <AnimatePresence>
              {preview && !reduce ? (
                <motion.div
                  key="preview"
                  aria-hidden
                  className="pointer-events-none absolute left-[62%] top-0 z-10 hidden md:block"
                  style={{ y: springY }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                >
                  <div className="relative -ml-28 -mt-[6.5rem] h-52 w-56 overflow-hidden rounded-[1.25rem] shadow-[0_30px_60px_-30px_rgb(15_23_42/0.6)] lg:-ml-32 lg:-mt-[7.5rem] lg:h-60 lg:w-64">
                    <AnimatePresence initial={false}>
                      <motion.div
                        key={preview.slug}
                        className="absolute inset-0"
                        initial={{ clipPath: 'inset(12% 12% 12% 12% round 20px)' }}
                        animate={{ clipPath: 'inset(0% 0% 0% 0% round 0px)' }}
                        transition={{ duration: 0.5, ease: EASE_OUT }}
                      >
                        <Image
                          src={preview.image}
                          alt=""
                          fill
                          sizes="256px"
                          className="object-cover"
                        />
                      </motion.div>
                    </AnimatePresence>
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
