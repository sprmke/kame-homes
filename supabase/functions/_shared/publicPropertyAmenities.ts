/**
 * Amenity id → display label catalog (mirrors ui propertySettingsConstants AMENITY_CATEGORIES).
 * Keep in sync when admin amenity ids change.
 */

export const AMENITY_LABELS: Record<string, string> = {
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
  sim_racing: 'Sim Racing',
  retro_games: 'Retro games',
  laptop_computer: 'Laptop/Computer',
  netflix: 'Netflix',
  disney_plus: 'Disney+',
  prime_video: 'Prime Video',
  hbo: 'HBO',
  karaoke: 'Karaoke',
  acoustic_guitar: 'Acoustic Guitar',
  card_board_games: 'Card & Board Games',
  pool: 'Swimming Pool',
  gym: 'Gym/Fitness Center',
  hot_tub: 'Hot Tub',
  sauna: 'Sauna',
  elevator: 'Elevator',
  parking: 'Free Parking',
  ev_charger: 'EV Charger',
  balcony: 'Balcony/Patio',
  garden: 'Garden',
  bbq: 'BBQ Grill',
  beach_access: 'Beach Access',
  outdoor_dining: 'Outdoor Dining',
  smoke_alarm: 'Smoke Alarm',
  fire_extinguisher: 'Fire Extinguisher',
  first_aid: 'First Aid Kit',
  security: '24/7 Security',
  cctv: 'CCTV',
  safe: 'Safe/Lockbox',
  crib: 'Crib',
  high_chair: 'High Chair',
  wheelchair: 'Wheelchair Accessible',
  step_free: 'Step-Free Access',
  pets_allowed: 'Pets Allowed',
};

export function resolveAmenityLabels(
  enabledIds: string[],
  customAmenities: Array<{ id: string; name: string }>
): string[] {
  const customById = new Map(customAmenities.map((entry) => [entry.id, entry.name.trim()]));
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const id of enabledIds) {
    const label = customById.get(id) ?? AMENITY_LABELS[id];
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  return labels;
}
