import { useQuery } from '@tanstack/react-query';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type PublicParkingPricing = {
  weekdayNightlyRate: number;
  weekendNightlyRate: number;
  dateOverrides: Record<string, number>;
  currency: string;
};

export type PublicParkingDetail = {
  id: string;
  slug: string;
  name: string;
  residenceName: string | null;
  tower: string | null;
  level: string | null;
  slotLabel: string;
  parkingType: string;
  ratePerNight: number | null;
  brandColor: string;
  description: string | null;
  spaceLengthM: number;
  spaceWidthM: number;
  heightClearanceM: number;
  checkInTime: string;
  checkOutTime: string;
  pricing: PublicParkingPricing;
  coverImage: string | null;
  images: string[];
  features: string[];
  notes: string | null;
  address: string;
  city: string;
  province: string | null;
  country: string;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  orgSlug: string;
  orgName: string;
  /** This listing's Recommended badge (listing Tier 2). */
  recommendedBadge?: boolean;
};

async function fetchPublicParking(slug: string): Promise<PublicParkingDetail> {
  const res = await fetch(
    `${FUNCTIONS_URL}/get-public-parking?parking=${encodeURIComponent(slug)}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  const json = (await res.json()) as {
    success?: boolean;
    data?: PublicParkingDetail;
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Parking not found');
  }
  return json.data;
}

export function usePublicParkingDetail(slug: string) {
  return useQuery({
    queryKey: ['public-parking', slug],
    queryFn: () => fetchPublicParking(slug),
    enabled: Boolean(slug),
    retry: false,
    // Matches the server's `publicDynamic` class (max-age=60) — see doc 11 Phase 11.6.
    staleTime: 60_000,
  });
}
