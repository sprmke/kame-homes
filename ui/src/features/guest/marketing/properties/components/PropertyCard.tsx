import { memo, useState } from 'react';

import { Link } from 'react-router-dom';

import { motion } from 'framer-motion';
import { Star, MapPin, Users, Bed, Bath, ChevronLeft, ChevronRight, Wifi, Car } from 'lucide-react';

import { PropertySaveButton } from '@/features/guest/marketing/properties/components/PropertySaveButton';
import { placeLabelFromPropertyLocation } from '@/features/guest/marketing/properties/lib/groupPropertiesByLocation';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';
import { resolveListingImages } from '@/features/guest/marketing/shared/lib/mockListingImages';

import { cn } from '@/lib/utils';

export interface Property {
  id: string;
  /** URL-friendly slug used for public property routes (e.g. "modern-makati-condo") */
  slug: string;
  name: string;
  location: string;
  price: number;
  rating?: number | null;
  reviews?: number | null;
  images: string[];
  type: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  isSuperhost?: boolean;
  isNew?: boolean;
  /** Slug of the development this property belongs to (optional) */
  developmentSlug?: string;
  /** Display name of the development (optional) */
  developmentName?: string;
  /** Tower name when unit is inside a development (optional) */
  tower?: string;
  /** Unit number — floor derived for 4-digit Azure-style numbers (optional) */
  unitNumber?: string;
  /** Legacy combined tower + unit string (optional) */
  towerAndUnit?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface PropertyCardProps {
  property: Property;
  index?: number;
  /** Compact photo-first card for location carousels */
  variant?: 'default' | 'carousel';
}

export const PropertyCard = memo(function PropertyCard({
  property,
  index = 0,
  variant = 'default',
}: PropertyCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const images = resolveListingImages(property.images, 'property', property.slug);

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  if (variant === 'carousel') {
    const place = placeLabelFromPropertyLocation(property.location);
    const cover = images[0] ?? '';

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.04 }}
        className="group"
      >
        <Link to={`/properties/${property.slug}`} className="block">
          <div className="relative mb-2 aspect-square overflow-hidden rounded-xl">
            {cover ? (
              <Image
                src={cover}
                alt={property.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : null}
            <PropertySaveButton propertySlug={property.slug} variant="carousel" />
            {(property.isSuperhost || property.isNew) && (
              <div className="absolute left-3 top-3">
                <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-sm backdrop-blur-sm">
                  {property.isSuperhost ? 'Superhost' : 'New'}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-foreground line-clamp-1 text-sm font-semibold">
                {property.type} in {place}
              </h3>
              {property.rating != null && property.reviews != null && (
                <div className="flex shrink-0 items-center gap-0.5 text-sm">
                  <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  <span className="font-medium">{property.rating.toFixed(2)}</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground line-clamp-1 text-sm">{property.name}</p>
            <p className="text-foreground text-sm">
              <span className="font-semibold">₱{property.price.toLocaleString()}</span>
              <span className="text-muted-foreground"> / night</span>
            </p>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="border-border bg-card hover:border-primary/20 overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-xl">
        <Link to={`/properties/${property.slug}`} className="block">
          <div className="relative aspect-[4/3] overflow-hidden">
            <div className="relative h-full w-full">
              {images.map((image, idx) => (
                <Image
                  key={idx}
                  src={image}
                  alt={`${property.name} - Image ${idx + 1}`}
                  fill
                  className={cn(
                    'object-cover transition-all duration-500',
                    idx === currentImageIndex ? 'scale-100 opacity-100' : 'scale-105 opacity-0',
                    isHovered && idx === currentImageIndex && 'scale-110'
                  )}
                />
              ))}
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

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
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
                {property.type}
              </span>
            </div>

            <PropertySaveButton propertySlug={property.slug} variant="card" />

            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white/90 p-1.5 opacity-0 shadow-lg backdrop-blur-sm transition-all hover:bg-white group-hover:opacity-100"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-900" />
                </button>
                <button
                  onClick={nextImage}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white/90 p-1.5 opacity-0 shadow-lg backdrop-blur-sm transition-all hover:bg-white group-hover:opacity-100"
                >
                  <ChevronRight className="h-4 w-4 text-slate-900" />
                </button>

                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCurrentImageIndex(idx);
                      }}
                      aria-label={`Image ${idx + 1}`}
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        idx === currentImageIndex
                          ? 'w-4 bg-white'
                          : 'w-1.5 bg-white/60 hover:bg-white/80'
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-foreground group-hover:text-primary line-clamp-1 text-sm font-semibold transition-colors lg:text-base">
                {property.name}
              </h3>
              {property.rating != null && property.reviews != null && (
                <div className="flex shrink-0 items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-foreground font-medium">{property.rating.toFixed(2)}</span>
                  <span className="text-muted-foreground">({property.reviews})</span>
                </div>
              )}
            </div>

            <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs lg:text-sm">
              <MapPin className="h-3.5 w-3.5" />
              <span className="line-clamp-1">{property.location}</span>
            </div>

            <div className="text-muted-foreground mb-3 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {property.guests}
              </span>
              <span className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                {property.bedrooms}
              </span>
              <span className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                {property.bathrooms}
              </span>
            </div>

            <div className="mb-4 flex gap-2">
              {property.amenities.slice(0, 3).map((amenity) => (
                <span
                  key={amenity}
                  className="bg-muted text-muted-foreground flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                >
                  {amenity === 'WiFi' && <Wifi className="h-3 w-3" />}
                  {amenity === 'Parking' && <Car className="h-3 w-3" />}
                  {amenity}
                </span>
              ))}
              {property.amenities.length > 3 && (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs">
                  +{property.amenities.length - 3}
                </span>
              )}
            </div>

            <div className="border-border flex items-center justify-between border-t pt-3">
              <div>
                <span className="text-foreground text-lg font-bold tabular-nums">
                  ₱{property.price.toLocaleString()}
                </span>
                <span className="text-muted-foreground text-sm"> / night</span>
              </div>
              <span className="text-primary text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                View details →
              </span>
            </div>
          </div>
        </Link>
      </div>
    </motion.div>
  );
});
