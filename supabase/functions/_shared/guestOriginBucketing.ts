/**
 * Free-text guest origin bucketing — no lat/lng/city column exists on guest_submissions today,
 * so this is a ranked list built from keyword matching, not a map.
 * PH labels use "City, Province" when a city match exists; province-only when that is all we know.
 * Mirror on UI: none needed — server always returns the bucketed distribution.
 */

/** Ordered so more specific matches win before broader ones (city before province catch-all). */
const PH_LOCATION_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  // Metro Manila
  {
    label: 'Quezon City, Metro Manila',
    keywords: ['quezon city', 'qc'],
  },
  { label: 'Makati, Metro Manila', keywords: ['makati'] },
  {
    label: 'Taguig, Metro Manila',
    keywords: ['taguig', 'bgc', 'bonifacio global'],
  },
  { label: 'Pasig, Metro Manila', keywords: ['pasig'] },
  { label: 'Mandaluyong, Metro Manila', keywords: ['mandaluyong'] },
  {
    label: 'Parañaque, Metro Manila',
    keywords: ['paranaque', 'parañaque'],
  },
  { label: 'Pasay, Metro Manila', keywords: ['pasay'] },
  { label: 'Muntinlupa, Metro Manila', keywords: ['muntinlupa'] },
  { label: 'Marikina, Metro Manila', keywords: ['marikina'] },
  { label: 'Caloocan, Metro Manila', keywords: ['caloocan'] },
  { label: 'Malabon, Metro Manila', keywords: ['malabon'] },
  { label: 'Navotas, Metro Manila', keywords: ['navotas'] },
  { label: 'Valenzuela, Metro Manila', keywords: ['valenzuela'] },
  {
    label: 'Las Piñas, Metro Manila',
    keywords: ['las pinas', 'las piñas'],
  },
  { label: 'San Juan, Metro Manila', keywords: ['san juan'] },
  {
    label: 'Manila, Metro Manila',
    keywords: ['manila', 'metro manila', 'ncr'],
  },

  // Cebu
  { label: 'Mandaue, Cebu', keywords: ['mandaue'] },
  {
    label: 'Lapu-Lapu, Cebu',
    keywords: ['lapu-lapu', 'lapu lapu'],
  },
  { label: 'Talisay, Cebu', keywords: ['talisay city'] },
  { label: 'Cebu City, Cebu', keywords: ['cebu city', 'cebu'] },

  // Davao
  { label: 'Davao City, Davao del Sur', keywords: ['davao'] },

  // Iloilo / Baguio / Bacolod
  { label: 'Iloilo City, Iloilo', keywords: ['iloilo'] },
  { label: 'Baguio, Benguet', keywords: ['baguio'] },
  {
    label: 'Bacolod, Negros Occidental',
    keywords: ['bacolod', 'negros occidental'],
  },

  // Bulacan
  { label: 'Malolos, Bulacan', keywords: ['malolos'] },
  {
    label: 'San Jose del Monte, Bulacan',
    keywords: ['san jose del monte'],
  },
  { label: 'Bulacan', keywords: ['bulacan'] },

  // Cavite
  {
    label: 'Dasmariñas, Cavite',
    keywords: ['dasmarinas', 'dasmariñas'],
  },
  { label: 'Bacoor, Cavite', keywords: ['bacoor'] },
  { label: 'Imus, Cavite', keywords: ['imus'] },
  { label: 'Cavite', keywords: ['cavite'] },

  // Laguna
  { label: 'Santa Rosa, Laguna', keywords: ['santa rosa'] },
  { label: 'Calamba, Laguna', keywords: ['calamba'] },
  {
    label: 'Los Baños, Laguna',
    keywords: ['los banos', 'los baños'],
  },
  { label: 'Laguna', keywords: ['laguna'] },

  // Pampanga
  { label: 'Angeles, Pampanga', keywords: ['angeles city'] },
  { label: 'Clark, Pampanga', keywords: ['clark'] },
  { label: 'Pampanga', keywords: ['pampanga'] },

  // Rizal
  { label: 'Antipolo, Rizal', keywords: ['antipolo'] },
  { label: 'Cainta, Rizal', keywords: ['cainta'] },
  { label: 'Rizal', keywords: ['rizal'] },

  // Batangas / Zambales
  { label: 'Batangas', keywords: ['batangas'] },
  { label: 'Subic, Zambales', keywords: ['subic'] },
  { label: 'Zambales', keywords: ['zambales'] },

  // Palawan
  { label: 'Puerto Princesa, Palawan', keywords: ['puerto princesa'] },
  { label: 'El Nido, Palawan', keywords: ['el nido'] },
  { label: 'Coron, Palawan', keywords: ['coron'] },
  { label: 'Palawan', keywords: ['palawan'] },

  // Mindanao hubs
  {
    label: 'Cagayan de Oro, Misamis Oriental',
    keywords: ['cagayan de oro', 'cdo'],
  },
  {
    label: 'General Santos, South Cotabato',
    keywords: ['general santos', 'gensan'],
  },
  {
    label: 'Zamboanga City, Zamboanga del Sur',
    keywords: ['zamboanga'],
  },
];

const COUNTRY_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  { label: 'Philippines', keywords: ['philippines', 'pilipinas', 'ph'] },
  { label: 'United States', keywords: ['united states', 'usa', 'u.s.a', 'u.s.', 'america'] },
  { label: 'Canada', keywords: ['canada'] },
  { label: 'Australia', keywords: ['australia'] },
  { label: 'United Kingdom', keywords: ['united kingdom', 'uk', 'england', 'scotland', 'wales'] },
  { label: 'Japan', keywords: ['japan'] },
  { label: 'South Korea', keywords: ['south korea', 'korea'] },
  { label: 'Singapore', keywords: ['singapore'] },
  { label: 'China', keywords: ['china'] },
  { label: 'Saudi Arabia', keywords: ['saudi arabia', 'saudi'] },
  {
    label: 'United Arab Emirates',
    keywords: ['united arab emirates', 'uae', 'dubai', 'abu dhabi'],
  },
  { label: 'Qatar', keywords: ['qatar'] },
  { label: 'Germany', keywords: ['germany'] },
  { label: 'Italy', keywords: ['italy'] },
  { label: 'Spain', keywords: ['spain'] },
  { label: 'New Zealand', keywords: ['new zealand'] },
  { label: 'Malaysia', keywords: ['malaysia'] },
  { label: 'Hong Kong', keywords: ['hong kong'] },
  { label: 'Taiwan', keywords: ['taiwan'] },
];

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim();
}

function findLabel(
  haystack: string,
  table: Array<{ label: string; keywords: string[] }>
): string | null {
  for (const entry of table) {
    if (entry.keywords.some((keyword) => haystack.includes(keyword))) {
      return entry.label;
    }
  }
  return null;
}

/**
 * Buckets a guest's free-text address/nationality into a ranked-list-friendly label.
 * PH city/region match takes priority over country (most guests are domestic); falls back to
 * a matched country, then 'Unknown'. Never throws — always returns a usable bucket label.
 */
export function bucketGuestOrigin(
  guestAddress: string | null | undefined,
  nationality: string | null | undefined
): string {
  const address = normalize(guestAddress);
  const nation = normalize(nationality);
  const combined = `${address} ${nation}`.trim();
  if (!combined) return 'Unknown';

  const phMatch = findLabel(combined, PH_LOCATION_KEYWORDS);
  if (phMatch) return phMatch;

  const countryMatch = findLabel(combined, COUNTRY_KEYWORDS);
  if (countryMatch) return countryMatch;

  return 'Unknown';
}
