import { useState } from 'react';

import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import {
  Star,
  MapPin,
  Users,
  Bed,
  Bath,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Car,
  UtensilsCrossed,
  Wind,
  Check,
} from 'lucide-react';

import { PropertySaveButton } from '@/features/guest/marketing/properties/components/PropertySaveButton';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Property } from './PropertyCard';

interface PropertyListItemProps {
  property: Property;
  index?: number;
}

const amenityIcons: Record<string, typeof Wifi> = {
  WiFi: Wifi,
  Parking: Car,
  Kitchen: UtensilsCrossed,
  'Air Conditioning': Wind,
};

export function PropertyListItem({ property, index = 0 }: PropertyListItemProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? property.images.length - 1 : prev - 1));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group"
    >
      <Link to={`/properties/${property.slug}`}>
        <div className="border-border bg-card hover:border-primary/20 flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-lg md:flex-row">
          {/* Image Section */}
          <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden md:aspect-[4/3] md:w-80 lg:w-96">
            {/* Images */}
            <div className="relative h-full w-full">
              {property.images.map((image, idx) => (
                <Image
                  key={idx}
                  src={image}
                  alt={`${property.name} - Image ${idx + 1}`}
                  fill
                  className={cn(
                    'object-cover transition-all duration-500',
                    idx === currentImageIndex ? 'opacity-100' : 'opacity-0'
                  )}
                />
              ))}
            </div>

            {/* Badges */}
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              {property.isSuperhost && (
                <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-sm backdrop-blur-sm">
                  Superhost
                </span>
              )}
              {property.isNew && (
                <span className="bg-primary rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                  New
                </span>
              )}
            </div>

            <PropertySaveButton propertySlug={property.slug} variant="list" />

            {/* Image Navigation */}
            {property.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 opacity-0 shadow-lg backdrop-blur-sm transition-all hover:bg-white group-hover:opacity-100"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-900" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 opacity-0 shadow-lg backdrop-blur-sm transition-all hover:bg-white group-hover:opacity-100"
                >
                  <ChevronRight className="h-4 w-4 text-slate-900" />
                </button>

                {/* Image Dots */}
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {property.images.slice(0, 5).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCurrentImageIndex(idx);
                      }}
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        idx === currentImageIndex
                          ? 'w-4 bg-white'
                          : 'w-1.5 bg-white/60 hover:bg-white/80'
                      )}
                    />
                  ))}
                  {property.images.length > 5 && (
                    <span className="text-xs text-white/80">+{property.images.length - 5}</span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Content Section */}
          <div className="flex flex-1 flex-col p-5 md:p-6">
            {/* Header */}
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {property.type}
                  </span>
                </div>
                <h3 className="text-foreground group-hover:text-primary text-base font-semibold transition-colors md:text-lg">
                  {property.name}
                </h3>
              </div>
              {property.rating != null && property.reviews != null && (
                <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 dark:bg-amber-950/50">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {property.rating.toFixed(2)}
                  </span>
                  <span className="text-sm text-amber-600/80 dark:text-amber-500/80">
                    ({property.reviews})
                  </span>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="text-muted-foreground mb-4 flex items-center gap-1 text-sm">
              <MapPin className="h-4 w-4" />
              <span>{property.location}</span>
            </div>

            {/* Stats */}
            <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>{property.guests} guests</span>
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Bed className="h-4 w-4" />
                <span>{property.bedrooms} bedrooms</span>
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Bath className="h-4 w-4" />
                <span>{property.bathrooms} bathrooms</span>
              </span>
            </div>

            {/* Amenities */}
            <div className="mb-4 flex flex-wrap gap-2">
              {property.amenities.slice(0, 4).map((amenity) => {
                const Icon = amenityIcons[amenity] || Check;
                return (
                  <span
                    key={amenity}
                    className="border-border bg-background text-muted-foreground flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {amenity}
                  </span>
                );
              })}
              {property.amenities.length > 4 && (
                <span className="border-border bg-background text-muted-foreground rounded-full border px-3 py-1 text-xs">
                  +{property.amenities.length - 4} more
                </span>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Footer */}
            <div className="border-border flex items-center justify-between border-t pt-4">
              <div>
                <span className="text-foreground text-lg font-bold tabular-nums sm:text-xl">
                  ₱{property.price.toLocaleString()}
                </span>
                <span className="text-muted-foreground"> / night</span>
              </div>
              <Button className="rounded-full" size="sm">
                View Details
              </Button>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
