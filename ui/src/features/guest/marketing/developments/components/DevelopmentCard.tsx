import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import { MapPin, Star, Building2, Home, Layers, ArrowRight } from 'lucide-react';

import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import { resolveListingCoverImage } from '@/features/guest/marketing/shared/lib/mockListingImages';

import { DEVELOPMENT_TYPE_BADGE } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

import type { Development, DevelopmentType } from '../types';

const TYPE_CONFIG: Record<
  DevelopmentType,
  { label: string; shortLabel: string; icon: typeof Building2; color: string }
> = {
  CONDOMINIUM: {
    label: 'Condominium',
    shortLabel: 'Condo',
    icon: Building2,
    color: DEVELOPMENT_TYPE_BADGE.CONDOMINIUM,
  },
  SUBDIVISION: {
    label: 'Subdivision',
    shortLabel: 'Subdivision',
    icon: Home,
    color: DEVELOPMENT_TYPE_BADGE.SUBDIVISION,
  },
  MIXED_USE: {
    label: 'Mixed-Use',
    shortLabel: 'Mixed-Use',
    icon: Layers,
    color: DEVELOPMENT_TYPE_BADGE.MIXED_USE,
  },
  TOWNHOUSE: {
    label: 'Townhouse',
    shortLabel: 'Townhouse',
    icon: Home,
    color: DEVELOPMENT_TYPE_BADGE.TOWNHOUSE,
  },
  COMMERCIAL: {
    label: 'Commercial',
    shortLabel: 'Commercial',
    icon: Building2,
    color: DEVELOPMENT_TYPE_BADGE.COMMERCIAL,
  },
};

interface DevelopmentCardProps {
  development: Development;
  index?: number;
  /** Compact photo-first card for location carousels */
  variant?: 'default' | 'carousel';
}

export function DevelopmentCard({
  development,
  index = 0,
  variant = 'default',
}: DevelopmentCardProps) {
  const typeConfig = TYPE_CONFIG[development.type];
  const TypeIcon = typeConfig.icon;
  const coverImage = resolveListingCoverImage(
    development.images,
    development.coverImage,
    'development',
    development.slug
  );

  if (variant === 'carousel') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.04 }}
        className="group"
      >
        <Link to={`/developments/${development.slug}`} className="block">
          <div className="relative mb-2 aspect-square overflow-hidden rounded-xl">
            <Image
              src={coverImage}
              alt={development.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute left-3 top-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm',
                  typeConfig.color,
                  'bg-background/85'
                )}
              >
                <TypeIcon className="h-3 w-3" />
                {typeConfig.shortLabel}
              </span>
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-foreground line-clamp-1 text-sm font-semibold">
                {typeConfig.shortLabel} in {development.city}
              </h3>
              {development.rating != null && (
                <div className="flex shrink-0 items-center gap-0.5 text-sm">
                  <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span className="font-medium">{development.rating.toFixed(2)}</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground line-clamp-1 text-sm">{development.name}</p>
            <p className="text-foreground text-sm">
              <span className="font-semibold">₱{development.priceRange.min.toLocaleString()}</span>
              <span className="text-muted-foreground"> / night</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-muted-foreground">{development.propertyCount} homes</span>
            </p>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="group"
    >
      <Link to={`/developments/${development.slug}`}>
        <div className="border-border bg-card hover:border-primary/20 overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-xl">
          <div className="relative aspect-[16/9] overflow-hidden">
            <Image
              src={coverImage}
              alt={development.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

            <div className="absolute left-3 top-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm',
                  typeConfig.color,
                  'bg-background/80'
                )}
              >
                <TypeIcon className="h-3.5 w-3.5" />
                {typeConfig.label}
              </span>
            </div>

            <div className="absolute bottom-3 right-3">
              <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                {development.propertyCount} homes available
              </span>
            </div>

            <div className="absolute bottom-3 left-3">
              <span className="text-xs font-medium text-white/80">{development.developerName}</span>
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-foreground group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors lg:text-base">
                {development.name}
              </h3>
              {development.rating && (
                <div className="flex shrink-0 items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-foreground font-medium">{development.rating}</span>
                </div>
              )}
            </div>

            <div className="text-muted-foreground mb-3 flex items-center gap-1 text-xs lg:text-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{development.location}</span>
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {development.amenities.slice(0, 3).map((amenity) => (
                <span
                  key={amenity}
                  className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs"
                >
                  {amenity}
                </span>
              ))}
              {development.amenities.length > 3 && (
                <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs">
                  +{development.amenities.length - 3} more
                </span>
              )}
            </div>

            <div className="border-border flex items-center justify-between border-t pt-3">
              <div>
                <span className="text-muted-foreground text-xs">From </span>
                <span className="text-foreground text-lg font-bold">
                  ₱{development.priceRange.min.toLocaleString()}
                </span>
                <span className="text-muted-foreground text-xs"> / night</span>
              </div>
              <span className="text-primary flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                Explore homes
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
