import type { ParkingSlot } from '../types';

/** Azure North tower names */
export const AZURE_NORTH_TOWERS = ['Monaco', 'Bali', 'Barbados', 'Bay'] as const;

/** Azure North parking levels */
export const AZURE_NORTH_LEVELS = ['Ground', '2nd Floor', '3rd Floor', 'Basement 1'] as const;

export const mockParkingSlots: ParkingSlot[] = [
  // ── Monaco tower ───────────────────────────────────────────────────
  {
    id: 'azure-monaco-b1-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'M-B1-001',
    type: 'inside_tower',
    tower: 'Monaco',
    level: 'Basement 1',
    isAvailable: true,
    ratePerNight: 350,
    features: ['CCTV', '24/7 Security', 'Fire Suppression'],
  },
  {
    id: 'azure-monaco-b1-002',
    developmentId: 'dev-azure-north',
    slotLabel: 'M-B1-002',
    type: 'inside_tower',
    tower: 'Monaco',
    level: 'Basement 1',
    isAvailable: false,
    ratePerNight: 350,
    features: ['CCTV', '24/7 Security', 'Fire Suppression'],
  },
  {
    id: 'azure-monaco-b1-003',
    developmentId: 'dev-azure-north',
    slotLabel: 'M-B2-001',
    type: 'inside_tower',
    tower: 'Monaco',
    level: '2nd Floor',
    isAvailable: true,
    ratePerNight: 400,
    features: ['CCTV', '24/7 Security', 'Fire Suppression'],
  },
  {
    id: 'azure-monaco-g-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'M-G-001',
    type: 'outside_tower',
    tower: 'Monaco',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 300,
    features: ['CCTV', '24/7 Security'],
  },
  {
    id: 'azure-monaco-g-002',
    developmentId: 'dev-azure-north',
    slotLabel: 'M-G-002',
    type: 'outside_tower',
    tower: 'Monaco',
    level: 'Ground',
    isAvailable: false,
    ratePerNight: 300,
    features: ['CCTV', '24/7 Security'],
  },
  {
    id: 'azure-monaco-m01',
    developmentId: 'dev-azure-north',
    slotLabel: 'M-M01',
    type: 'motorcycle',
    tower: 'Monaco',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 200,
    features: ['CCTV', '24/7 Security', 'Covered Shade'],
  },

  // ── Bali tower ─────────────────────────────────────────────────────
  {
    id: 'azure-bali-b1-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'B-B1-001',
    type: 'inside_tower',
    tower: 'Bali',
    level: 'Basement 1',
    isAvailable: true,
    ratePerNight: 320,
    features: ['CCTV', '24/7 Security', 'Fire Suppression'],
  },
  {
    id: 'azure-bali-b1-002',
    developmentId: 'dev-azure-north',
    slotLabel: 'B-B1-002',
    type: 'inside_tower',
    tower: 'Bali',
    level: 'Basement 1',
    isAvailable: true,
    ratePerNight: 320,
    features: ['CCTV', '24/7 Security', 'Fire Suppression'],
  },
  {
    id: 'azure-bali-g-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'B-G-001',
    type: 'outside_tower',
    tower: 'Bali',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 250,
    features: ['CCTV', '24/7 Security'],
  },
  {
    id: 'azure-bali-g-002',
    developmentId: 'dev-azure-north',
    slotLabel: 'B-G-002',
    type: 'outside_tower',
    tower: 'Bali',
    level: 'Ground',
    isAvailable: false,
    ratePerNight: 250,
    features: ['CCTV', '24/7 Security'],
  },
  {
    id: 'azure-bali-b2-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'B-B2-001',
    type: 'inside_tower',
    tower: 'Bali',
    level: '2nd Floor',
    isAvailable: true,
    ratePerNight: 450,
    features: ['CCTV', '24/7 Security', 'Fire Suppression'],
  },
  {
    id: 'azure-bali-m01',
    developmentId: 'dev-azure-north',
    slotLabel: 'B-M01',
    type: 'motorcycle',
    tower: 'Bali',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 180,
    features: ['CCTV', '24/7 Security', 'Covered Shade'],
  },

  // ── Barbados tower ────────────────────────────────────────────────
  {
    id: 'azure-barbados-b2-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'BR-B2-001',
    type: 'inside_tower',
    tower: 'Barbados',
    level: '2nd Floor',
    isAvailable: true,
    ratePerNight: 500,
    features: ['EV Charging Station', 'CCTV', '24/7 Security'],
  },
  {
    id: 'azure-barbados-b2-002',
    developmentId: 'dev-azure-north',
    slotLabel: 'BR-B2-002',
    type: 'inside_tower',
    tower: 'Barbados',
    level: '2nd Floor',
    isAvailable: true,
    ratePerNight: 400,
    features: ['Accessible Ramp', 'CCTV', '24/7 Security', 'Extra Wide Bay'],
  },
  {
    id: 'azure-barbados-b3-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'BR-B3-001',
    type: 'inside_tower',
    tower: 'Barbados',
    level: '3rd Floor',
    isAvailable: false,
    ratePerNight: 500,
    features: ['EV Charging Station', 'CCTV', '24/7 Security'],
  },
  {
    id: 'azure-barbados-g-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'BR-G-001',
    type: 'outside_tower',
    tower: 'Barbados',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 280,
    features: ['CCTV', '24/7 Security'],
  },
  {
    id: 'azure-barbados-m01',
    developmentId: 'dev-azure-north',
    slotLabel: 'BR-M01',
    type: 'motorcycle',
    tower: 'Barbados',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 250,
    features: ['CCTV', '24/7 Security', 'Covered Shade'],
  },
  {
    id: 'azure-barbados-m02',
    developmentId: 'dev-azure-north',
    slotLabel: 'BR-M02',
    type: 'motorcycle',
    tower: 'Barbados',
    level: 'Ground',
    isAvailable: false,
    ratePerNight: 250,
    features: ['CCTV', '24/7 Security', 'Covered Shade'],
  },

  // ── Bay ground parking ─────────────────────────────────────────────
  {
    id: 'azure-bay-g-001',
    developmentId: 'dev-azure-north',
    slotLabel: 'BAY-001',
    type: 'outside_tower',
    tower: 'Bay',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 200,
    features: ['CCTV', '24/7 Security', 'Visitor Parking'],
    notes: 'Open-air bays along the lagoon promenade',
  },
  {
    id: 'azure-bay-g-002',
    developmentId: 'dev-azure-north',
    slotLabel: 'BAY-002',
    type: 'outside_tower',
    tower: 'Bay',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 200,
    features: ['CCTV', '24/7 Security', 'Visitor Parking'],
  },
  {
    id: 'azure-bay-g-003',
    developmentId: 'dev-azure-north',
    slotLabel: 'BAY-003',
    type: 'outside_tower',
    tower: 'Bay',
    level: 'Ground',
    isAvailable: false,
    ratePerNight: 200,
    features: ['CCTV', '24/7 Security', 'Visitor Parking'],
  },
  {
    id: 'azure-bay-g-004',
    developmentId: 'dev-azure-north',
    slotLabel: 'BAY-004',
    type: 'outside_tower',
    tower: 'Bay',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 220,
    features: ['CCTV', '24/7 Security', 'Oversized Vehicle'],
    notes: 'SUV / van bays near commercial strip',
  },
  {
    id: 'azure-bay-m01',
    developmentId: 'dev-azure-north',
    slotLabel: 'BAY-M01',
    type: 'motorcycle',
    tower: 'Bay',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 120,
    features: ['CCTV', 'Covered Shade'],
  },

  // ── Crosswinds Tagaytay ────────────────────────────────────────────
  {
    id: 'crosswinds-p1',
    developmentId: 'dev-crosswinds',
    slotLabel: 'P-A01',
    type: 'outside_tower',
    tower: 'Chalet Village',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 250,
    features: ['CCTV', 'Gated Access'],
  },
  {
    id: 'crosswinds-p2',
    developmentId: 'dev-crosswinds',
    slotLabel: 'P-A02',
    type: 'outside_tower',
    tower: 'Chalet Village',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 250,
    imageUrl: 'https://images.unsplash.com/photo-1568605117037-7b3c22336e38?w=800&q=80',
    features: ['CCTV', 'Gated Access'],
  },
  {
    id: 'crosswinds-p3',
    developmentId: 'dev-crosswinds',
    slotLabel: 'P-B01',
    type: 'inside_tower',
    tower: 'Swiss Quadrille',
    level: 'Basement 1',
    isAvailable: false,
    ratePerNight: 350,
    features: ['CCTV', '24/7 Security', 'Covered'],
  },
  {
    id: 'crosswinds-p4',
    developmentId: 'dev-crosswinds',
    slotLabel: 'P-M01',
    type: 'motorcycle',
    tower: 'Chalet Village',
    level: 'Ground',
    isAvailable: true,
    ratePerNight: 150,
    features: ['CCTV', 'Covered Shade'],
  },
];

export function getParkingSlotsByDevelopment(developmentId: string): ParkingSlot[] {
  return mockParkingSlots.filter((slot) => slot.developmentId === developmentId);
}

const SLUG_TO_DEV_ID: Record<string, string> = {
  'azure-north-residences': 'dev-azure-north',
  'avida-towers-bgc': 'dev-avida-bgc',
  'shore-2-residences': 'dev-shore-residences',
  'camella-laguna': 'dev-camella-laguna',
  'smdc-wind-residences': 'dev-smdc-wind',
  'brittany-sta-rosa': 'dev-brittany-sta-rosa',
  'paseo-sta-rosa': 'dev-paseo-sta-rosa',
  'crosswinds-tagaytay': 'dev-crosswinds',
};

export function getParkingSlotsByDevelopmentSlug(
  slug: string,
  options?: { availableOnly?: boolean }
): ParkingSlot[] {
  const id = SLUG_TO_DEV_ID[slug];
  if (!id) return [];
  const slots = getParkingSlotsByDevelopment(id);
  if (options?.availableOnly) return slots.filter((slot) => slot.isAvailable);
  return slots;
}

export function getParkingSlotById(id: string): ParkingSlot | undefined {
  return mockParkingSlots.find((slot) => slot.id === id);
}

/** Get a parking slot by development slug and slot id. Returns undefined if slot not found or not in this development. */
export function getParkingSlotByDevelopmentSlugAndId(
  slug: string,
  parkingId: string
): ParkingSlot | undefined {
  const developmentId = SLUG_TO_DEV_ID[slug];
  if (!developmentId) return undefined;
  const slot = mockParkingSlots.find((s) => s.id === parkingId);
  if (!slot || slot.developmentId !== developmentId) return undefined;
  return slot;
}
