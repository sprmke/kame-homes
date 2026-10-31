/**
 * Amenity id → short display label for public search cards.
 * Keep aligned with supabase/functions/_shared/publicPropertyAmenities.ts.
 */
const AMENITY_LABELS: Record<string, string> = {
  wifi: 'WiFi',
  aircon: 'Air Conditioning',
  heating: 'Heating',
  tv: 'TV',
  washer: 'Washer',
  dryer: 'Dryer',
  iron: 'Iron',
  hair_dryer: 'Hair Dryer',
  kitchen: 'Kitchen',
  refrigerator: 'Refrigerator',
  microwave: 'Microwave',
  stove: 'Stove/Cooktop',
  oven: 'Oven',
  coffee: 'Coffee Maker',
  dishes: 'Dishes & Silverware',
  dining_area: 'Dining Area',
  ps5: 'PS5',
  ps4: 'PS4',
  nintendo_switch: 'Nintendo Switch',
  xbox: 'Xbox',
  pool: 'Pool',
  gym: 'Gym',
  parking: 'Parking',
  balcony: 'Balcony',
  pets_allowed: 'Pets Allowed',
};

export function formatAmenityLabel(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return '';
  return (
    AMENITY_LABELS[trimmed] ?? trimmed.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatAmenityLabels(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const label = formatAmenityLabel(id);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}
