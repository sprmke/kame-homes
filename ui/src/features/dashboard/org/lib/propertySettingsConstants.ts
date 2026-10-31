import {
  Building2,
  Gamepad2,
  Grid3X3,
  Home,
  Key,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condominium' },
  { value: 'house', label: 'House' },
  { value: 'villa', label: 'Villa' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'resort', label: 'Resort' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'other', label: 'Other' },
] as const;

export const PROPERTY_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active', dotClass: 'bg-green-500' },
  { value: 'INACTIVE', label: 'Inactive', dotClass: 'bg-gray-500' },
] as const;

export const PROPERTY_CONTACT_ROLES = [
  { value: 'unit_owner', label: 'Unit Owner' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'sublessee', label: 'Sublessee' },
  { value: 'authorized_representative', label: 'Authorized Representative' },
  { value: 'property_admin', label: 'Property Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'other', label: 'Other' },
] as const;

export type PropertyContactRole = (typeof PROPERTY_CONTACT_ROLES)[number]['value'];

export const PROPERTY_CONTACT_ROLE_VALUES = PROPERTY_CONTACT_ROLES.map((entry) => entry.value);

export type PropertyMediaItem = {
  id: string;
  url: string;
  storagePath?: string;
  type: 'image' | 'video';
  caption?: string;
  isPrimary?: boolean;
  order: number;
};

export type CustomAmenity = {
  id: string;
  name: string;
  categoryId: string;
};

/** Max length for user-added amenity labels (matches custom house rules). */
export const CUSTOM_AMENITY_MAX_LENGTH = 50;

export type AmenityCategory = {
  id: string;
  name: string;
  icon: LucideIcon;
  amenities: { id: string; name: string }[];
};

export const AMENITY_CATEGORIES: AmenityCategory[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    icon: Home,
    amenities: [
      { id: 'wifi', name: 'WiFi' },
      { id: 'aircon', name: 'Air Conditioning' },
      { id: 'heating', name: 'Heating' },
      { id: 'tv', name: 'TV' },
      { id: 'washer', name: 'Washer' },
      { id: 'dryer', name: 'Dryer' },
      { id: 'iron', name: 'Iron' },
      { id: 'hair_dryer', name: 'Hair Dryer' },
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen & Dining',
    icon: Grid3X3,
    amenities: [
      { id: 'kitchen', name: 'Kitchen' },
      { id: 'refrigerator', name: 'Refrigerator' },
      { id: 'microwave', name: 'Microwave' },
      { id: 'stove', name: 'Stove/Cooktop' },
      { id: 'oven', name: 'Oven' },
      { id: 'coffee', name: 'Coffee Maker' },
      { id: 'dishes', name: 'Dishes & Silverware' },
      { id: 'dining_area', name: 'Dining Area' },
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: Gamepad2,
    amenities: [
      { id: 'ps5', name: 'PS5' },
      { id: 'ps4', name: 'PS4' },
      { id: 'nintendo_switch', name: 'Nintendo Switch' },
      { id: 'xbox', name: 'Xbox' },
      { id: 'sim_racing', name: 'Sim Racing' },
      { id: 'retro_games', name: 'Retro games' },
      { id: 'laptop_computer', name: 'Laptop/Computer' },
      { id: 'netflix', name: 'Netflix' },
      { id: 'disney_plus', name: 'Disney+' },
      { id: 'prime_video', name: 'Prime Video' },
      { id: 'hbo', name: 'HBO' },
      { id: 'karaoke', name: 'Karaoke' },
      { id: 'acoustic_guitar', name: 'Acoustic Guitar' },
      { id: 'card_board_games', name: 'Card & Board Games' },
    ],
  },
  {
    id: 'facilities',
    name: 'Facilities',
    icon: Building2,
    amenities: [
      { id: 'pool', name: 'Swimming Pool' },
      { id: 'gym', name: 'Gym/Fitness Center' },
      { id: 'hot_tub', name: 'Hot Tub' },
      { id: 'sauna', name: 'Sauna' },
      { id: 'elevator', name: 'Elevator' },
      { id: 'parking', name: 'Free Parking' },
      { id: 'ev_charger', name: 'EV Charger' },
    ],
  },
  {
    id: 'outdoor',
    name: 'Outdoor',
    icon: Sparkles,
    amenities: [
      { id: 'balcony', name: 'Balcony/Patio' },
      { id: 'garden', name: 'Garden' },
      { id: 'bbq', name: 'BBQ Grill' },
      { id: 'beach_access', name: 'Beach Access' },
      { id: 'outdoor_dining', name: 'Outdoor Dining' },
    ],
  },
  {
    id: 'safety',
    name: 'Safety & Security',
    icon: Key,
    amenities: [
      { id: 'smoke_alarm', name: 'Smoke Alarm' },
      { id: 'fire_extinguisher', name: 'Fire Extinguisher' },
      { id: 'first_aid', name: 'First Aid Kit' },
      { id: 'security', name: '24/7 Security' },
      { id: 'cctv', name: 'CCTV' },
      { id: 'safe', name: 'Safe/Lockbox' },
    ],
  },
  {
    id: 'family',
    name: 'Family & Accessibility',
    icon: Users,
    amenities: [
      { id: 'crib', name: 'Crib' },
      { id: 'high_chair', name: 'High Chair' },
      { id: 'wheelchair', name: 'Wheelchair Accessible' },
      { id: 'step_free', name: 'Step-Free Access' },
      { id: 'pets_allowed', name: 'Pets Allowed' },
    ],
  },
];

export const INITIAL_ENABLED_AMENITIES = [
  'wifi',
  'aircon',
  'tv',
  'kitchen',
  'refrigerator',
  'pool',
  'parking',
  'balcony',
  'smoke_alarm',
  'security',
];

/** Resolve enabled amenity ids (+ custom names) to guest-facing labels. */
export function resolveAmenityLabels(
  enabledIds: string[],
  customAmenities: Array<{ id: string; name: string }>
): string[] {
  const presetById = new Map(
    AMENITY_CATEGORIES.flatMap((category) =>
      category.amenities.map((amenity) => [amenity.id, amenity.name] as const)
    )
  );
  const customById = new Map(customAmenities.map((entry) => [entry.id, entry.name.trim()]));
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const id of enabledIds) {
    const label = customById.get(id) ?? presetById.get(id);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  return labels;
}
