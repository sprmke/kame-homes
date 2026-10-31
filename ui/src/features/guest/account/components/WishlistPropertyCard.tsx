import { Link } from 'react-router-dom';

import { Star } from 'lucide-react';

import { PropertySaveButton } from '@/features/guest/marketing/properties/components/PropertySaveButton';
import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';
import { placeLabelFromPropertyLocation } from '@/features/guest/marketing/properties/lib/groupPropertiesByLocation';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

export function WishlistPropertyCardSkeleton() {
  return (
    <div className="w-full min-w-0 space-y-1.5" aria-hidden>
      <div className="bg-muted aspect-square w-full animate-pulse rounded-lg" />
      <div className="bg-muted h-3 w-[85%] animate-pulse rounded" />
      <div className="bg-muted h-3 w-[55%] animate-pulse rounded" />
      <div className="bg-muted h-3 w-[40%] animate-pulse rounded" />
    </div>
  );
}

export function WishlistPropertyCard({ slug }: { slug: string }) {
  const { data: property } = usePublicPropertyDetail(slug);

  if (!property) {
    return <WishlistPropertyCardSkeleton />;
  }

  const place = placeLabelFromPropertyLocation(property.location);
  const cover = property.images[0] ?? '';
  const propertyHref = `/properties/${property.slug}`;

  return (
    <article className="group w-full min-w-0">
      <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg">
        <Link to={propertyHref} className="block size-full" aria-label={property.name}>
          {cover ? (
            <Image
              src={cover}
              alt={property.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
        </Link>
        <PropertySaveButton
          propertySlug={property.slug}
          variant="carousel"
          confirmUnsave
          propertyName={property.name}
          className="right-2 top-2 z-10 min-h-[35px] min-w-[35px] p-1.5 shadow-md"
        />
        {property.isSuperhost ? (
          <div className="pointer-events-none absolute left-2 top-2">
            <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold leading-none text-slate-900 shadow-sm backdrop-blur-sm">
              Guest favorite
            </span>
          </div>
        ) : null}
      </div>

      <Link to={propertyHref} className="block space-y-0.5">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="text-foreground line-clamp-1 text-xs font-semibold">
            {property.type} in {place}
          </h3>
          <div className="flex shrink-0 items-center gap-0.5 text-xs">
            <Star className="h-3 w-3 fill-current" aria-hidden="true" />
            <span className="font-medium">{(property.rating ?? 0).toFixed(2)}</span>
          </div>
        </div>
        <p className="text-muted-foreground line-clamp-1 text-xs">{property.name}</p>
        <p className="text-foreground text-xs">
          <span className="font-semibold">₱{property.pricing.baseRate.toLocaleString()}</span>
          <span className="text-muted-foreground"> / night</span>
        </p>
      </Link>
    </article>
  );
}
