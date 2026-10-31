import { useMemo, useState } from 'react';

import { motion } from 'framer-motion';
import {
  Wifi,
  Car,
  UtensilsCrossed,
  Wind,
  Tv,
  Waves,
  Dumbbell,
  Lock,
  Flame,
  Coffee,
  Snowflake,
  Sun,
  Trees,
  Umbrella,
  ShieldCheck,
  Baby,
  Accessibility,
  PawPrint,
  Utensils,
  Microwave,
  Shirt,
  HardHat,
  BatteryCharging,
  Armchair,
  type LucideIcon,
  Check,
  ChevronRight,
} from 'lucide-react';

import { GuestDialogShell } from '@/features/guest/marketing/shared/components/GuestDialogShell';

import { Button } from '@/components/ui/button';

interface PropertyAmenitiesProps {
  amenities: string[];
}

// Amenity icon mapping
const amenityIcons: Record<string, LucideIcon> = {
  // Essentials
  WiFi: Wifi,
  'Air Conditioning': Wind,
  Heating: Flame,
  TV: Tv,
  Washer: Shirt,
  Dryer: Shirt,
  Iron: Shirt,
  'Hair Dryer': Wind,

  // Kitchen & Dining
  Kitchen: UtensilsCrossed,
  Refrigerator: Snowflake,
  Microwave: Microwave,
  'Stove/Cooktop': Flame,
  Oven: Flame,
  'Coffee Maker': Coffee,
  'Dishes & Silverware': Utensils,
  'Dining Area': Armchair,

  // Facilities
  'Swimming Pool': Waves,
  Pool: Waves,
  'Gym/Fitness Center': Dumbbell,
  Gym: Dumbbell,
  'Hot Tub': Waves,
  Sauna: Flame,
  Elevator: HardHat,
  'Free Parking': Car,
  Parking: Car,
  'EV Charger': BatteryCharging,

  // Outdoor
  'Balcony/Patio': Sun,
  Balcony: Sun,
  Garden: Trees,
  'BBQ Grill': Flame,
  BBQ: Flame,
  'Beach Access': Umbrella,
  'Outdoor Dining': Utensils,

  // Safety
  'Smoke Alarm': ShieldCheck,
  'Fire Extinguisher': Flame,
  'First Aid Kit': ShieldCheck,
  '24/7 Security': Lock,
  CCTV: ShieldCheck,
  'Safe/Lockbox': Lock,

  // Family & Accessibility
  Crib: Baby,
  'High Chair': Baby,
  'Wheelchair Accessible': Accessibility,
  'Step-Free Access': Accessibility,
  'Pets Allowed': PawPrint,
  'Pet Friendly': PawPrint,
};

// Amenity categories
const amenityCategories: Record<string, { label: string; items: string[] }> = {
  essentials: {
    label: 'Essentials',
    items: ['WiFi', 'Air Conditioning', 'Heating', 'TV', 'Washer', 'Dryer', 'Iron', 'Hair Dryer'],
  },
  kitchen: {
    label: 'Kitchen & Dining',
    items: [
      'Kitchen',
      'Refrigerator',
      'Microwave',
      'Stove/Cooktop',
      'Oven',
      'Coffee Maker',
      'Dishes & Silverware',
      'Dining Area',
    ],
  },
  facilities: {
    label: 'Facilities',
    items: [
      'Swimming Pool',
      'Pool',
      'Gym/Fitness Center',
      'Gym',
      'Hot Tub',
      'Sauna',
      'Elevator',
      'Free Parking',
      'Parking',
      'EV Charger',
    ],
  },
  outdoor: {
    label: 'Outdoor',
    items: [
      'Balcony/Patio',
      'Balcony',
      'Garden',
      'BBQ Grill',
      'BBQ',
      'Beach Access',
      'Outdoor Dining',
    ],
  },
  safety: {
    label: 'Safety & Security',
    items: [
      'Smoke Alarm',
      'Fire Extinguisher',
      'First Aid Kit',
      '24/7 Security',
      'CCTV',
      'Safe/Lockbox',
    ],
  },
  family: {
    label: 'Family & Accessibility',
    items: [
      'Crib',
      'High Chair',
      'Wheelchair Accessible',
      'Step-Free Access',
      'Pets Allowed',
      'Pet Friendly',
    ],
  },
};

const DISPLAY_LIMIT = 10;

function AmenityRow({
  amenity,
  variant = 'default',
}: {
  amenity: string;
  variant?: 'default' | 'compact';
}) {
  const Icon = amenityIcons[amenity] || Check;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3">
        <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
        <span className="text-muted-foreground">{amenity}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="bg-muted rounded-lg p-2.5">
        <Icon className="text-foreground h-5 w-5" />
      </div>
      <span className="text-foreground">{amenity}</span>
    </div>
  );
}

function useAmenityGroups(amenities: string[]) {
  return useMemo(() => {
    const categorizedAmenities = Object.entries(amenityCategories).reduce(
      (acc, [key, category]) => {
        const matchedAmenities = category.items.filter((item) =>
          amenities.some((a) => a.toLowerCase() === item.toLowerCase())
        );
        if (matchedAmenities.length > 0) {
          acc[key] = matchedAmenities;
        }
        return acc;
      },
      {} as Record<string, string[]>
    );

    const allCategorizedItems = Object.values(amenityCategories).flatMap((c) =>
      c.items.map((i) => i.toLowerCase())
    );
    const uncategorizedAmenities = amenities.filter(
      (a) => !allCategorizedItems.includes(a.toLowerCase())
    );

    return { categorizedAmenities, uncategorizedAmenities };
  }, [amenities]);
}

function AmenitiesByCategory({
  categorizedAmenities,
  uncategorizedAmenities,
}: {
  categorizedAmenities: Record<string, string[]>;
  uncategorizedAmenities: string[];
}) {
  return (
    <div className="space-y-6">
      {Object.entries(categorizedAmenities).map(([key, items]) => (
        <div key={key} className="space-y-3">
          <h3 className="text-foreground font-medium">{amenityCategories[key]?.label}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((amenity) => (
              <AmenityRow key={amenity} amenity={amenity} variant="compact" />
            ))}
          </div>
        </div>
      ))}

      {uncategorizedAmenities.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-foreground font-medium">Other</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {uncategorizedAmenities.map((amenity) => (
              <AmenityRow key={amenity} amenity={amenity} variant="compact" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PropertyAmenities({ amenities }: PropertyAmenitiesProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { categorizedAmenities, uncategorizedAmenities } = useAmenityGroups(amenities);
  const previewAmenities = amenities.slice(0, DISPLAY_LIMIT);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-6"
      >
        <h2 className="text-foreground @xl:text-xl text-lg font-semibold">
          What this place offers
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {previewAmenities.map((amenity, index) => (
            <motion.div
              key={amenity}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
            >
              <AmenityRow amenity={amenity} />
            </motion.div>
          ))}
        </div>

        {amenities.length > DISPLAY_LIMIT ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalOpen(true)}
            className="h-10 w-full gap-2 rounded-xl sm:w-auto"
          >
            Show all {amenities.length} amenities
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </motion.section>

      <GuestDialogShell
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="What this place offers"
        sizeClassName="max-w-[min(calc(100vw-1.5rem),32rem)] sm:max-w-[min(90vw,32rem)]"
      >
        <AmenitiesByCategory
          categorizedAmenities={categorizedAmenities}
          uncategorizedAmenities={uncategorizedAmenities}
        />
      </GuestDialogShell>
    </>
  );
}
