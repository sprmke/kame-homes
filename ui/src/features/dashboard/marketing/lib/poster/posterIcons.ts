import { POSTER_ICON_NODES } from '@/features/dashboard/marketing/lib/poster/posterIconNodes';

/**
 * Poster icon set: one line-icon family at one stroke weight, so an amenity row
 * reads as a designed set instead of mixed clip-art (the Four J's / Kame references
 * all use a single consistent outline style).
 */

/**
 * Same encoding as OpenPolotno's `svgToURL`, but via `globalThis.btoa` so the
 * compiler also runs outside a browser window (unit tests, future server render).
 */
export function posterSvgUrl(markup: string): string {
  const bytes = new TextEncoder().encode(markup);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${globalThis.btoa(binary)}`;
}

export type PosterIconName = keyof typeof POSTER_ICON_NODES;

export const POSTER_ICON_NAMES = Object.keys(POSTER_ICON_NODES) as PosterIconName[];

export function isPosterIconName(value: unknown): value is PosterIconName {
  return typeof value === 'string' && value in POSTER_ICON_NODES;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function posterIconSvgMarkup(
  name: PosterIconName,
  options: { color: string; strokeWidth?: number; size?: number }
): string {
  const size = options.size ?? 96;
  const strokeWidth = options.strokeWidth ?? 1.6;
  const body = POSTER_ICON_NODES[name]
    .map(([tag, attrs]) => {
      const attrText = Object.entries(attrs)
        .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
        .join(' ');
      return `<${tag} ${attrText}/>`;
    })
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"`,
    ` fill="none" stroke="${escapeAttr(options.color)}" stroke-width="${strokeWidth}"`,
    ` stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
  ].join('');
}

export function posterIconSvgUrl(
  name: PosterIconName,
  options: { color: string; strokeWidth?: number }
): string {
  return posterSvgUrl(posterIconSvgMarkup(name, options));
}

/**
 * Keyword → icon, checked in order (first match wins). Keyword matching instead of
 * exact labels so host-typed custom amenities ("Heated Jacuzzi", "PS5 + games",
 * "Netflix") still land on a sensible icon.
 */
const AMENITY_ICON_RULES: Array<[RegExp, PosterIconName]> = [
  [/wi-?fi|internet/i, 'wifi'],
  [/jacuzzi|hot tub|bathtub|bath tub|\bspa\b/i, 'bath'],
  [/pool|swim|beach/i, 'waves'],
  [/bbq|grill|barbecue/i, 'flame'],
  [/parking|garage|\bcar\b/i, 'car'],
  [/ps5|ps4|playstation|xbox|nintendo|switch|game|arcade|billiard/i, 'gamepad-2'],
  [/karaoke|videoke|\bmic\b/i, 'mic'],
  [/netflix|cinema|movie|projector|youtube/i, 'monitor-play'],
  [/\btv\b|television|cable/i, 'tv'],
  [/coffee|espresso|nespresso|dolce gusto/i, 'coffee'],
  [/kitchen|cook|stove|oven|dining|utensil/i, 'utensils-crossed'],
  [/microwave/i, 'microwave'],
  [/air ?con|aircon|a\/c|\bac\b|air-conditioned/i, 'snowflake'],
  [/\bfans?\b|hair dryer/i, 'wind'],
  [/refrigerator|fridge/i, 'snowflake'],
  [/washer|dryer|laundry|iron/i, 'shirt'],
  [/gym|fitness/i, 'dumbbell'],
  [/balcony|patio|terrace|view|sunset/i, 'sunset'],
  [/garden|outdoor|lawn|trees/i, 'trees'],
  [/mountain|nature/i, 'mountain'],
  [/secur|cctv|guard|alarm|first aid|safe/i, 'shield-check'],
  [/lock|keyless|self check/i, 'key-round'],
  [/pet|dog|cat/i, 'paw-print'],
  [/crib|baby|kid/i, 'baby'],
  [/bed|queen|king|sleep/i, 'bed-double'],
  [/sofa|couch|living/i, 'sofa'],
  [/wine|bar\b|drinks/i, 'wine'],
  [/music|speaker|sound/i, 'music'],
  [/bike|bicycle/i, 'bike'],
  [/private|exclusive|resort|villa|house|home/i, 'home'],
  [/book|library|reading/i, 'book-open'],
  [/tropical|palm/i, 'palmtree'],
];

export function resolvePosterIcon(label: string): PosterIconName {
  for (const [pattern, icon] of AMENITY_ICON_RULES) {
    if (pattern.test(label)) return icon;
  }
  return 'sparkles';
}

/**
 * Short forms for tight icon labels. Curated, never derived: chopping to the last word
 * turns "Coffee Maker" into "Maker". No match means the item is dropped instead.
 */
const SHORT_LABEL_RULES: Array<[RegExp, string]> = [
  [/air ?con|aircon|air-conditioned/i, 'Aircon'],
  [/swimming pool|infinity pool|pool/i, 'Pool'],
  [/jacuzzi|hot tub/i, 'Jacuzzi'],
  [/coffee/i, 'Coffee'],
  [/parking|garage/i, 'Parking'],
  [/wi-?fi|internet/i, 'WiFi'],
  [/kitchen/i, 'Kitchen'],
  [/netflix/i, 'Netflix'],
  [/washer|dryer|laundry/i, 'Laundry'],
  [/bbq|grill|barbecue/i, 'BBQ'],
  [/ps5|playstation/i, 'PS5'],
  [/karaoke|videoke/i, 'Karaoke'],
  [/balcony|patio|terrace/i, 'Balcony'],
  [/security|cctv/i, 'Security'],
  [/pet/i, 'Pet friendly'],
  [/\btv\b|television/i, 'TV'],
  [/gym|fitness/i, 'Gym'],
];

export function shortPosterLabel(label: string): string | null {
  for (const [pattern, short] of SHORT_LABEL_RULES) {
    if (pattern.test(label)) return short.toLowerCase() === label.toLowerCase() ? null : short;
  }
  return null;
}
