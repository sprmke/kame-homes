import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  normalizePosterSpec,
  type PosterArchetypeId,
  type PosterFacts,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * Rule-based poster specs. Used when the AI director is unavailable, fails, or
 * returns fewer variants than asked, so "Generate" always yields finished posters.
 * Copy here is deliberately plain and fact-based; the director writes the voice.
 */

export const POSTER_GOAL_ARCHETYPES: Record<PosterGoal, PosterArchetypeId[]> = {
  vibe: ['sky-headline', 'wave-duo', 'magazine-cover', 'minimal-title'],
  promo: ['sky-headline', 'feature-sticker', 'wave-duo', 'night-glass'],
  'amenity-spotlight': ['feature-sticker', 'wave-duo', 'sky-headline', 'magazine-cover'],
  'feature-spotlight': ['feature-sticker', 'magazine-cover', 'wave-duo', 'sky-headline'],
  'stay-info': ['sky-headline', 'night-glass', 'wave-duo', 'minimal-title'],
};

function shortAmenity(label: string): string {
  return label
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .split(/[/&]/)[0]!
    .trim();
}

function baseCopy(facts: PosterFacts, goal: PosterGoal) {
  const place = facts.location?.split(',')[0]?.trim() || null;
  const chips = facts.amenities.slice(0, 3).map(shortAmenity);
  const staycation = place ? `${place} Staycation` : 'Your Staycation';
  const byGoal: Record<PosterGoal, { eyebrow: string; headline: string; accent: string }> = {
    vibe: { eyebrow: 'Your next staycation', headline: facts.propertyName, accent: staycation },
    promo: { eyebrow: 'Book direct', headline: 'Save on your stay', accent: 'Special rate' },
    'amenity-spotlight': {
      eyebrow: 'Everything you need',
      headline: facts.propertyName,
      accent: 'Made for slow days',
    },
    'feature-spotlight': {
      eyebrow: 'Level up your stay',
      headline: facts.amenities[0]
        ? `${shortAmenity(facts.amenities[0])} included`
        : facts.propertyName,
      accent: 'Good vibes only',
    },
    'stay-info': { eyebrow: 'Plan your stay', headline: facts.propertyName, accent: staycation },
  };
  return {
    ...byGoal[goal],
    subhead: place
      ? `A cozy stay in ${place}, ready when you are.`
      : 'A cozy stay, ready when you are.',
    chips,
    tagline: 'Unwind. Recharge. Just like home.',
    cta: 'Book your stay',
    badge: facts.amenities[0] ? `${shortAmenity(facts.amenities[0])} for your stay` : 'Book direct',
    listTitle: 'Perfect for',
  };
}

export function buildRuleBasedPosterSpecs(
  facts: PosterFacts,
  goal: PosterGoal,
  options?: { accent?: string | null; count?: number }
): PosterSpec[] {
  const archetypes = POSTER_GOAL_ARCHETYPES[goal].slice(0, options?.count ?? 4);
  const copy = baseCopy(facts, goal);
  return archetypes.map((archetype, index) =>
    normalizePosterSpec(
      {
        archetype,
        fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
        goal,
        palette: { accent: options?.accent ?? null },
        copy,
        // Rotate hero photos so the four variants don't all lead with the same shot.
        photoIndexes:
          facts.photos.length > 0
            ? [index % facts.photos.length, (index + 1) % facts.photos.length]
            : [],
        label: `${facts.propertyName} poster`,
      },
      facts
    )
  );
}
