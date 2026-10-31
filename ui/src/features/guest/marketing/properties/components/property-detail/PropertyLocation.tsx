import { motion } from 'framer-motion';
import { MapPin, Navigation, Train, Plane, Coffee, ShoppingBag } from 'lucide-react';

import { PropertyMapEmbed } from '@/features/guest/marketing/properties/components/property-detail/PropertyMapEmbed';

import { Button } from '@/components/ui/button';

interface PropertyLocationProps {
  address: string;
  city: string;
  state?: string | null;
  country: string;
  zipCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  showNearbyPlaces?: boolean;
}

const nearbyPlaces = [
  { name: 'Airport', distance: '45 min', icon: Plane },
  { name: 'Train Station', distance: '15 min', icon: Train },
  { name: 'Shopping Mall', distance: '10 min', icon: ShoppingBag },
  { name: 'Restaurants', distance: '5 min', icon: Coffee },
];

export function PropertyLocation({
  address,
  city,
  state,
  country,
  zipCode,
  latitude,
  longitude,
  placeId,
  showNearbyPlaces = true,
}: PropertyLocationProps) {
  const fullAddress = [address, city, state, zipCode, country].filter(Boolean).join(', ');
  const locationString = [city, state, country].filter(Boolean).join(', ');

  const openInMaps = () => {
    if (latitude != null && longitude != null) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        '_blank'
      );
    } else {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`,
        '_blank'
      );
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="space-y-6"
    >
      <h2 className="text-foreground @xl:text-xl text-lg font-semibold">Where you&apos;ll be</h2>

      <div className="border-border bg-muted relative h-[300px] overflow-hidden rounded-2xl border sm:h-[400px]">
        <PropertyMapEmbed
          latitude={latitude}
          longitude={longitude}
          placeId={placeId}
          address={fullAddress}
        />

        <Button
          type="button"
          onClick={openInMaps}
          className="absolute bottom-4 left-4 z-10 gap-2 rounded-full shadow-lg"
        >
          <Navigation className="h-4 w-4" />
          Get directions
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <MapPin className="text-muted-foreground mt-1 h-5 w-5 shrink-0" />
          <div>
            <p className="text-foreground font-medium">{locationString}</p>
            {address ? <p className="text-muted-foreground text-sm">{address}</p> : null}
          </div>
        </div>

        {showNearbyPlaces ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {nearbyPlaces.map((place) => {
              const Icon = place.icon;
              return (
                <div
                  key={place.name}
                  className="border-border bg-card flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="bg-muted rounded-full p-2">
                    <Icon className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">{place.name}</p>
                    <p className="text-muted-foreground text-xs">{place.distance} away</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
