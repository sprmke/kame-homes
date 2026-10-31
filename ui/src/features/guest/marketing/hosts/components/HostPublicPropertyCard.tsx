import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';

import { guestPropertyPath } from '@/features/guest/lib/guestPublicPaths';
import type { PublicHostProfile } from '@/features/guest/marketing/properties/hooks/usePublicHost';
import { ListingRecommendedBadge } from '@/features/guest/marketing/shared/components/ListingRecommendedBadge';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

type Property = PublicHostProfile['properties'][number];

type Props = {
  property: Property;
  index?: number;
};

export function HostPublicPropertyCard({ property, index = 0 }: Props) {
  const href = guestPropertyPath(property.slug);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      className="group w-full min-w-0"
    >
      <Link to={href} className="block">
        <div className="bg-muted relative mb-2 aspect-square w-full overflow-hidden rounded-xl">
          {property.imageUrl ? (
            <Image
              src={property.imageUrl}
              alt={property.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
          {property.recommendedBadge ? (
            <ListingRecommendedBadge
              withTooltip={false}
              className="bg-background/90 absolute left-2 top-2 shadow-sm backdrop-blur"
            />
          ) : null}
        </div>

        <div className="space-y-0.5">
          <p className="text-foreground line-clamp-1 text-sm font-semibold">{property.name}</p>
          <p className="text-muted-foreground line-clamp-1 text-xs sm:text-sm">
            {property.type}
            {property.locationLabel ? ` · ${property.locationLabel}` : ''}
          </p>
          <p className="text-foreground text-sm">
            <span className="font-semibold">₱{property.weekdayNightlyRate.toLocaleString()}</span>
            <span className="text-muted-foreground"> / night</span>
          </p>
        </div>
      </Link>
    </motion.article>
  );
}
