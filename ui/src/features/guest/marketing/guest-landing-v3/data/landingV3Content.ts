/**
 * Static content for the `/v3` guest landing ("Quiet Arrival").
 *
 * Listings, places, parking, and developments come from the public APIs at runtime.
 * Photography and guest-voice quotes here are placeholder content until real property
 * photography and real guest reviews are supplied (see
 * `docs/workflow/in-progress/guest-landing-v3.md` §10). Nothing here states a real count,
 * rating, or price.
 */

const unsplash = (id: string, w = 2000) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

export const heroPhoto = {
  src: unsplash('1600596542815-ffad4c1539a9'),
  alt: 'A quiet, sunlit living room in a condo-tower unit',
} as const;

export const heroCopy = {
  eyebrow: 'Homes and parking, booked direct',
  headline: 'A quieter way to arrive',
} as const;

export type BundleItem = {
  icon: 'key' | 'car' | 'pass';
  title: string;
  detail: string;
};

export const bundleItems: BundleItem[] = [
  { icon: 'key', title: 'The unit', detail: 'Self check-in, sent before you arrive.' },
  { icon: 'car', title: 'A parking slot', detail: 'Same building, booked by the night.' },
  {
    icon: 'pass',
    title: 'The building pass',
    detail: 'Lobby and elevator access, approved ahead.',
  },
];

export const bundleCopy = {
  eyebrow: 'One booking',
  headline: 'The unit, the parking, the pass',
  sub: 'Airbnb gets you the unit. One Kame booking gets you the unit, the parking, and the gate open before you have left the car.',
} as const;

export type TrustPoint = {
  icon: 'verified' | 'direct' | 'fee' | 'host';
  title: string;
  detail: string;
};

export const trustPoints: TrustPoint[] = [
  {
    icon: 'verified',
    title: 'Verified listings',
    detail: 'Every host and unit is reviewed before it goes live, not just claimed.',
  },
  {
    icon: 'fee',
    title: 'No platform markup',
    detail: 'You pay the host rate. No OTA service fee added at checkout.',
  },
  {
    icon: 'direct',
    title: 'A real line to your host',
    detail: 'Message the person who actually holds the keys, before and during your stay.',
  },
  {
    icon: 'host',
    title: 'Building-backed',
    detail: 'Parking and lobby access come from the same tower management, not guesswork.',
  },
];

export const trustCopy = {
  eyebrow: 'Why book direct',
  headline: 'The quiet case for not using Airbnb this time',
} as const;

export type GuestQuote = { name: string; stay: string; quote: string };

/** Sample guest-voice content — swap for real reviews once available. Flagged, not hidden. */
export const guestQuotes: GuestQuote[] = [
  {
    name: 'Marie, Quezon City',
    stay: 'Azure North, 3 nights',
    quote:
      'Parking was already waiting when I pulled in. I did not expect that part to be the easy part.',
  },
  {
    name: 'Jofel, Cebu',
    stay: 'Bali Tower, 1 week',
    quote:
      'I messaged the host directly about an early check-in and got an answer in minutes, not a bot.',
  },
  {
    name: 'Ana, Makati',
    stay: 'Monaco Residences, a weekend',
    quote:
      'The building pass was ready at the lobby desk. It felt like visiting family, not checking into a rental.',
  },
];

export const guestVoiceCopy = {
  eyebrow: 'In their words',
  sampleNotice: 'Sample guest voices. Real reviews replace these as stays complete.',
} as const;

export type FaqItem = { question: string; answer: string };

export const faqItems: FaqItem[] = [
  {
    question: 'Is this legitimate, or is it easier to just use Airbnb?',
    answer:
      'Every listing is reviewed before it goes live, and parking and building access come from the tower’s own management, not a third party. You can message the host directly before paying anything.',
  },
  {
    question: 'How is this cheaper than Airbnb or Agoda?',
    answer:
      'You pay the host’s rate. There is no platform service fee added at checkout the way OTAs add one.',
  },
  {
    question: 'What if I only need parking, not a stay?',
    answer: 'Parking books on its own, by the night, in the same buildings. No stay required.',
  },
  {
    question: 'Can I reach my host after I have paid?',
    answer: 'Yes. The same chat thread stays open before, during, and after your stay.',
  },
];

export const faqCopy = { eyebrow: 'Before you ask', headline: 'A few straight answers' } as const;

export const closingPhoto = {
  src: unsplash('1600607687939-ce8a6c25118c'),
  alt: 'A balcony view over a quiet residential street at dusk',
} as const;

export const closingCopy = {
  headline: 'Where to next?',
} as const;
