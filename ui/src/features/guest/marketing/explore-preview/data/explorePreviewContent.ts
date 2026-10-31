/**
 * Content for the `/explore-preview` landing redesign proposal.
 *
 * Self-contained on purpose: this route is a manual-review preview and must not
 * couple to (or mutate) the live landing data in `../../guest-landing/data`.
 * Photos and rates are sample content for the preview, surfaced as such in the
 * page footnote.
 */

const img = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

export interface HeroSlide {
  id: string;
  place: string;
  image: string;
}

/** Cross-dissolving hero backdrop. Bright skies up top keep the transparent nav legible. */
export const heroSlides: HeroSlide[] = [
  { id: 'palawan', place: 'El Nido, Palawan', image: img('1499793983690-e29da59ef1c2') },
  { id: 'boracay', place: 'Boracay, Aklan', image: img('1602002418082-a4443e081dd1') },
  { id: 'tagaytay', place: 'Tagaytay Ridge', image: img('1600596542815-ffad4c1539a9') },
  { id: 'manila', place: 'Metro Manila', image: img('1573455494060-c5595004fb6c') },
];

export interface QuickDestination {
  label: string;
  query: string;
}

export const quickDestinations: QuickDestination[] = [
  { label: 'Boracay', query: 'Boracay' },
  { label: 'Siargao', query: 'Siargao' },
  { label: 'Palawan', query: 'Palawan' },
  { label: 'Cebu', query: 'Cebu' },
  { label: 'Baguio', query: 'Baguio' },
  { label: 'Tagaytay', query: 'Tagaytay' },
];

export interface FeaturedStay {
  id: string;
  name: string;
  location: string;
  guests: number;
  nightlyRate: number;
  rating: number;
  reviews: number;
  image: string;
}

/** One lead stay + a side pair carry the editorial grid; the rest run in the rail. */
export const featuredLead: FeaturedStay = {
  id: 'sunset-beach-villa',
  name: 'Sunset Beach Villa',
  location: 'Station 1, Boracay',
  guests: 8,
  nightlyRate: 8500,
  rating: 4.9,
  reviews: 127,
  image: img('1602002418082-a4443e081dd1', 1400),
};

export const featuredSide: FeaturedStay[] = [
  {
    id: 'makati-skyline-loft',
    name: 'Skyline Loft on Ayala',
    location: 'Makati CBD',
    guests: 4,
    nightlyRate: 3200,
    rating: 4.8,
    reviews: 89,
    image: img('1522708323590-d24dbb6b0267', 1000),
  },
  {
    id: 'tagaytay-hillside-retreat',
    name: 'Hillside Retreat',
    location: 'Tagaytay, Cavite',
    guests: 6,
    nightlyRate: 5800,
    rating: 4.95,
    reviews: 203,
    image: img('1600596542815-ffad4c1539a9', 1000),
  },
];

export const featuredRail: FeaturedStay[] = [
  {
    id: 'el-nido-beachfront',
    name: 'El Nido Beachfront',
    location: 'Corong-Corong, Palawan',
    guests: 10,
    nightlyRate: 12000,
    rating: 5.0,
    reviews: 56,
    image: img('1499793983690-e29da59ef1c2', 900),
  },
  {
    id: 'cebu-harbour-suite',
    name: 'Harbour Suite',
    location: 'Cebu City',
    guests: 3,
    nightlyRate: 4100,
    rating: 4.7,
    reviews: 64,
    image: img('1566073771259-6a8506099945', 900),
  },
  {
    id: 'baguio-pine-cabin',
    name: 'Pine Cabin',
    location: 'Baguio, Benguet',
    guests: 5,
    nightlyRate: 4500,
    rating: 4.85,
    reviews: 91,
    image: img('1519681393784-d120267933ba', 900),
  },
  {
    id: 'la-union-surf-house',
    name: 'Surf House',
    location: 'San Juan, La Union',
    guests: 6,
    nightlyRate: 5200,
    rating: 4.82,
    reviews: 74,
    image: img('1507525428034-b723cf961d3e', 900),
  },
];

export interface AtlasEntry {
  id: string;
  name: string;
  blurb: string;
  stays: number;
  query: string;
  image: string;
}

export const atlasEntries: AtlasEntry[] = [
  {
    id: 'boracay',
    name: 'Boracay',
    blurb: 'White sand, clear water, walkable beachfront',
    stays: 312,
    query: 'Boracay',
    image: img('1507525428034-b723cf961d3e', 1400),
  },
  {
    id: 'palawan',
    name: 'Palawan',
    blurb: 'Islands and hidden lagoons',
    stays: 167,
    query: 'Palawan',
    image: img('1518509562904-e7ef99cdcc86', 1000),
  },
  {
    id: 'manila',
    name: 'Metro Manila',
    blurb: 'City breaks and business stays',
    stays: 245,
    query: 'Manila',
    image: img('1573455494060-c5595004fb6c', 1000),
  },
  {
    id: 'cebu',
    name: 'Cebu',
    blurb: 'Island city, quick hops to the coast',
    stays: 138,
    query: 'Cebu',
    image: img('1566073771259-6a8506099945', 1000),
  },
  {
    id: 'baguio',
    name: 'Baguio',
    blurb: 'Cool pine air, a drive from the lowlands',
    stays: 96,
    query: 'Baguio',
    image: img('1519681393784-d120267933ba', 1000),
  },
];

export interface JourneyStep {
  index: string;
  title: string;
  body: string;
}

export const journeySteps: JourneyStep[] = [
  {
    index: '01',
    title: 'Search stays',
    body: 'Filter by place, dates, and who is coming. Every listing is checked before it goes live.',
  },
  {
    index: '02',
    title: 'Book in minutes',
    body: 'Pick your dates, review the total, and confirm. Secure checkout, no back and forth.',
  },
  {
    index: '03',
    title: 'Check in easy',
    body: 'Get the address, entry details, and a real contact the moment your booking is set.',
  },
];

export interface GuestVoice {
  quote: string;
  name: string;
  stay: string;
}

export const guestVoice: GuestVoice = {
  quote:
    'Booking took a few minutes and the place looked exactly like the photos. We had the address and a contact before we even packed.',
  name: 'Maria Santos',
  stay: 'Stayed at Sunset Beach Villa, Boracay',
};
