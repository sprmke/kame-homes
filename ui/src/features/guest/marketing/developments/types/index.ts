export type DevelopmentType =
  'CONDOMINIUM' | 'SUBDIVISION' | 'MIXED_USE' | 'TOWNHOUSE' | 'COMMERCIAL';

export type ParkingType = 'inside_tower' | 'outside_tower' | 'motorcycle';

export interface ParkingSlot {
  id: string;
  developmentId: string;
  slotLabel: string;
  type: ParkingType;
  /** Tower name within the development (e.g. Monaco, Bali, Barbados, Bay for Azure North) */
  tower: string;
  level: string;
  isAvailable: boolean;
  /** Rate per night in PHP. Undefined = included with booking (free) */
  ratePerNight?: number;
  features: string[];
  /** Optional hero image; falls back to type-based mock stock photo */
  imageUrl?: string;
  notes?: string;
}

export interface DevelopmentForm {
  id: string;
  type: 'parking' | 'guest' | 'pet' | 'other';
  label: string;
}

export interface Development {
  id: string;
  slug: string;
  name: string;
  developerName: string;
  type: DevelopmentType;
  location: string;
  city: string;
  description: string;
  coverImage: string;
  images: string[];
  amenities: string[];
  propertyCount: number;
  priceRange: { min: number; max: number };
  rating?: number;
  website?: string;
  established?: number;
  totalUnits?: number;
  propertyIds: string[];
  latitude?: number | null;
  longitude?: number | null;
  /** Optional parking form slug for development-level parking registration */
  parkingFormId?: string;
  /** Optional list of guest forms available at the development level */
  forms?: DevelopmentForm[];
}
