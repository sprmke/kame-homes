import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import { Building2, Car, MapPin } from 'lucide-react';

import {
  formatParkingSlotLocation,
  resolveParkingLocationBadge,
} from '@/features/guest/marketing/developments/lib/parkingSlotDisplay';
import { resolveParkingSlotImage } from '@/features/guest/marketing/developments/lib/parkingSlotMedia';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';

import type { ParkingSlot } from '../types';

const LOCATION_BADGE_CONFIG = {
  inside_tower: { label: 'Inside tower', icon: Building2 },
  outside_tower: { label: 'Outside tower', icon: Car },
} as const;

interface ParkingSlotCardProps {
  slot: ParkingSlot;
  developmentSlug: string;
  /** Shown below the title on catalog carousels (`/parkings`). */
  developmentName?: string;
  /** Overrides `developmentName` on carousel cards (e.g. tower · level on development pages). */
  subtitle?: string;
  /** City label for catalog title line, e.g. "Parking in Tagaytay". */
  city?: string;
  /** Public `/parkings/:slug` when set (top-level catalog). */
  detailSlug?: string;
  index?: number;
  variant?: 'default' | 'carousel';
}

export function ParkingSlotCard({
  slot,
  developmentSlug,
  developmentName,
  subtitle,
  city,
  detailSlug,
  index = 0,
  variant = 'default',
}: ParkingSlotCardProps) {
  const locationBadge = resolveParkingLocationBadge(slot);
  const badgeConfig = LOCATION_BADGE_CONFIG[locationBadge];
  const BadgeIcon = badgeConfig.icon;
  const locationLabel = formatParkingSlotLocation(slot);
  const imageUrl = resolveParkingSlotImage(slot);
  const previewFeatures = slot.features.slice(0, 2);
  const reserveHref = detailSlug
    ? `/parkings/${detailSlug}`
    : `/developments/${developmentSlug}/parking`;

  if (variant === 'carousel') {
    const place = city?.trim() || 'this area';
    const secondaryLine = subtitle?.trim() || developmentName?.trim();

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index, 4) * 0.03 }}
        className="group"
      >
        <Link to={reserveHref} className="block">
          <div className="bg-muted relative mb-2.5 aspect-square overflow-hidden rounded-xl">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt=""
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
                sizes="(max-width: 640px) 240px, 260px"
              />
            ) : (
              <div className="from-muted to-muted/60 h-full w-full bg-gradient-to-br" />
            )}

            <div className="absolute left-2.5 top-2.5">
              <span className="bg-background/90 text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur-sm">
                <BadgeIcon className="h-3 w-3" aria-hidden />
                {badgeConfig.label}
              </span>
            </div>
          </div>

          <div className="space-y-0.5">
            <h3 className="text-foreground line-clamp-1 text-sm font-semibold">
              Parking in {place}
            </h3>
            {secondaryLine ? (
              <p className="text-muted-foreground line-clamp-1 text-xs">{secondaryLine}</p>
            ) : null}
            {slot.ratePerNight != null ? (
              <p className="text-foreground pt-0.5 text-sm">
                <span className="font-semibold">₱{slot.ratePerNight.toLocaleString()}</span>
                <span className="text-muted-foreground"> / night</span>
              </p>
            ) : (
              <p className="text-foreground pt-0.5 text-sm font-semibold">Included</p>
            )}
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <article
      aria-label={`Parking slot ${slot.slotLabel}`}
      className="border-border bg-card hover:border-primary/20 group flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 280px, 320px"
          />
        ) : (
          <div className="from-muted to-muted/60 h-full w-full bg-gradient-to-br" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

        <div className="absolute left-3 top-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm backdrop-blur-sm">
            <BadgeIcon className="h-3.5 w-3.5" aria-hidden />
            {badgeConfig.label}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="truncate text-lg font-bold tracking-tight text-white drop-shadow-sm">
            {slot.slotLabel}
          </p>
          {locationLabel ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-white/90">
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{locationLabel}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {developmentName ? (
          <p className="text-muted-foreground line-clamp-1 text-sm">{developmentName}</p>
        ) : null}

        {previewFeatures.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {previewFeatures.map((feature) => (
              <span
                key={feature}
                className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium"
              >
                {feature}
              </span>
            ))}
            {slot.features.length > previewFeatures.length ? (
              <span className="text-muted-foreground px-1 text-[11px]">
                +{slot.features.length - previewFeatures.length}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          {slot.ratePerNight != null ? (
            <p className="text-foreground text-sm">
              <span className="text-base font-bold">₱{slot.ratePerNight.toLocaleString()}</span>
              <span className="text-muted-foreground"> / night</span>
            </p>
          ) : (
            <span className="text-foreground text-sm font-semibold">Included</span>
          )}

          <Button asChild size="sm" className="min-h-[44px] rounded-xl px-4 text-xs font-semibold">
            <Link to={reserveHref}>Reserve slot</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
