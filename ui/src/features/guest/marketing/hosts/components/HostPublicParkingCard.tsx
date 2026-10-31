import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import { Car } from 'lucide-react';

import { guestParkingPath } from '@/features/guest/lib/guestPublicPaths';
import type { PublicHostProfile } from '@/features/guest/marketing/properties/hooks/usePublicHost';
import { ListingRecommendedBadge } from '@/features/guest/marketing/shared/components/ListingRecommendedBadge';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

type Parking = PublicHostProfile['parkings'][number];

type Props = {
  parking: Parking;
  index?: number;
};

export function HostPublicParkingCard({ parking, index = 0 }: Props) {
  const href = guestParkingPath(parking.slug);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      className="group w-full min-w-0"
    >
      <Link to={href} className="block">
        <div className="bg-muted relative mb-2 aspect-square w-full overflow-hidden rounded-xl">
          {parking.imageUrl ? (
            <Image
              src={parking.imageUrl}
              alt={parking.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="from-muted to-muted/60 flex h-full w-full items-center justify-center bg-gradient-to-br">
              <Car className="text-muted-foreground/50 h-10 w-10" aria-hidden />
            </div>
          )}
          {parking.recommendedBadge ? (
            <ListingRecommendedBadge
              withTooltip={false}
              className="bg-background/90 absolute left-2 top-2 shadow-sm backdrop-blur"
            />
          ) : null}
        </div>

        <div className="space-y-0.5">
          <p className="text-foreground line-clamp-1 text-sm font-semibold">{parking.name}</p>
          <p className="text-muted-foreground line-clamp-1 text-xs sm:text-sm">
            {parking.parkingType}
            {parking.locationLabel ? ` · ${parking.locationLabel}` : ''}
          </p>
          <p className="text-foreground text-sm">
            <span className="font-semibold">₱{parking.weekdayNightlyRate.toLocaleString()}</span>
            <span className="text-muted-foreground"> / night</span>
          </p>
        </div>
      </Link>
    </motion.article>
  );
}
