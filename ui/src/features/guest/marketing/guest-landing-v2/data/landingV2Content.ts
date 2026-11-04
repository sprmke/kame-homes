/**
 * Static content for the `/v2` guest landing.
 *
 * Listings, places, and parking come from the public APIs at runtime. Only atmosphere
 * photography and the stay-journey copy live here; nothing in this file states a count,
 * rating, or price.
 */

const unsplash = (id: string, w = 2000) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

/** Hero window backdrop. Bright, calm, and readable under a dark bottom veil. */
export const apertureBackdrop = {
  src: unsplash('1582719508461-905c673771fd'),
  alt: 'Resort pool at dusk, framed by palm trees',
} as const;

/** Photo inside the illustrative booking screen. */
export const journeyStayPhoto = unsplash('1522708323590-d24dbb6b0267', 640);

export type JourneyStepId = 'book' | 'documents' | 'parking' | 'arrive';

export interface JourneyStep {
  id: JourneyStepId;
  title: string;
  body: string;
}

/** The guest side of the booking workflow, in the order a guest meets it. */
export const journeySteps: JourneyStep[] = [
  {
    id: 'book',
    title: 'Pick your dates',
    body: 'See open nights and the full price before you book.',
  },
  {
    id: 'documents',
    title: 'Send your forms once',
    body: 'Upload IDs and guest details. Your host sorts out the building pass.',
  },
  {
    id: 'parking',
    title: 'Add a parking slot',
    body: 'Driving in? Reserve a slot in the same building.',
  },
  {
    id: 'arrive',
    title: 'Arrive like a regular',
    body: 'Check-in steps, Wi-Fi, and your host chat stay on your phone.',
  },
];
