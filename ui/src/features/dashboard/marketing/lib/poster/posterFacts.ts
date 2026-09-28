import type { PosterFacts } from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * Builds the poster fact pack from data the Design tab already loads
 * (`usePublicPropertyDetail`). Anything a poster prints about the stay (times,
 * deposit, amenities, location) comes from here, never from the model.
 */

export type PosterFactsPropertyInput = {
  residenceName?: string | null;
  city?: string | null;
  state?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  amenities?: string[];
  pricing?: {
    baseRate?: number | null;
    currency?: string | null;
    securityDeposit?: number | null;
  } | null;
};

/** "14:00" / "14:00:00" / "2:00 PM" → "2:00 PM". Unknown shapes pass through trimmed. */
export function formatPosterTime(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/\b(am|pm|nn)\b/i.test(raw)) return raw.replace(/\s+/g, ' ').toUpperCase();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!match) return raw;
  const hours = Number(match[1]);
  const minutes = match[2]!;
  if (hours > 23) return raw;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

export function formatPosterMoney(
  amount: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency?.trim() || 'PHP',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₱${Math.round(amount).toLocaleString('en-PH')}`;
  }
}

export function formatPosterLocation(
  input: PosterFactsPropertyInput | null | undefined
): string | null {
  if (!input) return null;
  const parts = [input.residenceName, input.state || input.city]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const fallback = [input.city, input.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const chosen = parts.length > 0 ? parts : fallback;
  const unique = chosen.filter(
    (part, index) =>
      chosen.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index
  );
  return unique.length > 0 ? unique.join(', ') : null;
}

export function buildPosterFacts(input: {
  propertyName: string;
  brandName?: string | null;
  property?: PosterFactsPropertyInput | null;
  photos: string[];
  logoUrl?: string | null;
}): PosterFacts {
  const property = input.property ?? null;
  const photos = [...new Set(input.photos.map((url) => url.trim()).filter(Boolean))];
  return {
    propertyName: input.propertyName.trim(),
    brandName: input.brandName?.trim() || null,
    location: formatPosterLocation(property),
    checkIn: formatPosterTime(property?.checkInTime),
    checkOut: formatPosterTime(property?.checkOutTime),
    securityDeposit: formatPosterMoney(
      property?.pricing?.securityDeposit,
      property?.pricing?.currency
    ),
    nightlyRate: formatPosterMoney(property?.pricing?.baseRate, property?.pricing?.currency),
    amenities: (property?.amenities ?? []).map((label) => label.trim()).filter(Boolean),
    logoUrl: input.logoUrl?.trim() || null,
    photos,
  };
}
