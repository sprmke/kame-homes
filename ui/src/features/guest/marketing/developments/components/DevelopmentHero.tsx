import { useState } from 'react';

import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import {
  MapPin,
  Building2,
  Home,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Car,
} from 'lucide-react';

import { useDevelopmentHasParking } from '@/features/guest/marketing/developments/hooks/useDevelopmentHasParking';
import { ListingHeroSearch } from '@/features/guest/marketing/shared/components/ListingHeroSearch';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Development, DevelopmentType } from '../types';

const TYPE_LABELS: Record<DevelopmentType, { label: string; icon: typeof Building2 }> = {
  CONDOMINIUM: { label: 'Condominium', icon: Building2 },
  SUBDIVISION: { label: 'Subdivision', icon: Home },
  MIXED_USE: { label: 'Mixed-Use', icon: Layers },
  TOWNHOUSE: { label: 'Townhouse', icon: Home },
  COMMERCIAL: { label: 'Commercial', icon: Building2 },
};

interface DevelopmentHeroProps {
  development: Development;
}

export function DevelopmentHero({ development }: DevelopmentHeroProps) {
  const [activeImg, setActiveImg] = useState(0);
  const typeConfig = TYPE_LABELS[development.type];
  const TypeIcon = typeConfig.icon;
  const hasParking = useDevelopmentHasParking(development.slug);

  const prevImg = () =>
    setActiveImg((prev) => (prev === 0 ? development.images.length - 1 : prev - 1));
  const nextImg = () => setActiveImg((prev) => (prev + 1) % development.images.length);

  return (
    <section className="bg-background pt-20 lg:pt-24">
      <div className="container mx-auto px-4 pb-6 pt-4 sm:px-6 lg:px-8">
        <ListingHeroSearch />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="group relative h-[180px] overflow-hidden rounded-2xl sm:h-[220px] lg:h-[260px]">
          {development.images.map((img, idx) => (
            <Image
              key={idx}
              src={img}
              alt={`${development.name} - ${idx + 1}`}
              fill
              className={cn(
                'object-cover transition-all duration-700',
                idx === activeImg ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
              )}
            />
          ))}

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

          {development.images.length > 1 && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/70 group-hover:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextImg}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/70 group-hover:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                {development.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImg(idx)}
                    className={cn(
                      'rounded-full transition-all duration-300',
                      idx === activeImg
                        ? 'h-2 w-6 bg-white'
                        : 'h-2 w-2 bg-white/60 hover:bg-white/80'
                    )}
                    aria-label={`View image ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          <div className="absolute left-5 top-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm">
              <TypeIcon className="h-4 w-4" />
              {typeConfig.label}
            </span>
          </div>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="border-border bg-card/95 dark:bg-card/90 relative top-[-2rem] z-10 mx-8 overflow-hidden rounded-2xl border shadow-xl backdrop-blur-md"
          aria-label="Development overview"
        >
          <div className="px-8 py-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-primary text-sm font-semibold uppercase tracking-wider">
                  {development.developerName}
                </p>
                <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
                  {development.name}
                </h1>

                <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    {development.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <TypeIcon className="text-primary h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-foreground font-medium">{typeConfig.label}</span>
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="gap-2 rounded-xl">
                  <Link to={`/developments/${development.slug}/properties`}>
                    View Homes
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                {hasParking && (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-border hover:bg-muted gap-2 rounded-xl"
                  >
                    <Link to={`/developments/${development.slug}/parking`}>
                      <Car className="h-4 w-4" aria-hidden />
                      View Parking
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.article>
      </div>
    </section>
  );
}
