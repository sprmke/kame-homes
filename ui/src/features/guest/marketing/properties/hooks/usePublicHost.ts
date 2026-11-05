import { useQuery } from '@tanstack/react-query';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type PublicHostSocialLinks = {
  facebookUrl: string | null;
  airbnbUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
};

export type PublicHostProfile = {
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  tagline: string | null;
  description: string | null;
  ownerName: string;
  ownerAvatarUrl: string | null;
  /** Host-wide Recommended badge (org Tier 2). */
  verifiedBadge: boolean;
  /** Earned Superhost badge (org performance). */
  isSuperhost: boolean;
  socialLinks: PublicHostSocialLinks;
  properties: Array<{
    slug: string;
    name: string;
    type: string;
    locationLabel: string;
    imageUrl: string | null;
    weekdayNightlyRate: number;
    recommendedBadge: boolean;
  }>;
  parkings: Array<{
    slug: string;
    name: string;
    parkingType: string;
    locationLabel: string;
    imageUrl: string | null;
    weekdayNightlyRate: number;
    recommendedBadge: boolean;
  }>;
  reviewSummary?: {
    count: number;
    avgOverall: number | null;
  };
  recentReviews?: Array<{
    id: string;
    propertySlug: string;
    propertyName: string;
    guestName: string;
    starRating: number;
    reviewText: string | null;
    responseText: string | null;
    publishedAt: string | null;
  }>;
};

export const PUBLIC_HOST_QUERY_KEY = ['public-host'] as const;

function publicHostUrl(orgSlug: string): string {
  return `${FUNCTIONS_URL}/get-public-host?org=${encodeURIComponent(orgSlug)}`;
}

async function fetchPublicHost(orgSlug: string): Promise<PublicHostProfile | null> {
  const res = await fetch(publicHostUrl(orgSlug), {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  if (res.status === 404) return null;

  const json = (await res.json()) as {
    success?: boolean;
    data?: PublicHostProfile;
  };

  if (!json.success || !json.data) return null;
  return json.data;
}

export function usePublicHost(orgSlug: string) {
  const slug = orgSlug.trim();

  return useQuery({
    queryKey: [...PUBLIC_HOST_QUERY_KEY, slug] as const,
    queryFn: () => fetchPublicHost(slug),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}
