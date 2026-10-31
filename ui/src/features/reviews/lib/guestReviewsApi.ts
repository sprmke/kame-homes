import type { GuestReputation } from '@/features/reviews/lib/reviewApi';

import { supabase } from '@/lib/supabase/client';

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type EdgeJson = {
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

async function guestJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required.');
  return token;
}

async function guestEdge(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const jwt = await guestJwt();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const json = (await res.json().catch(() => ({}))) as EdgeJson;
  if (!res.ok || !json.success) throw new Error(json.error ?? 'Request failed');
  const payload = json.data;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  return json as Record<string, unknown>;
}

export type GuestReviewListTab = 'to_write' | 'by_you' | 'about_you';

/** Booking access token for the item's `/guest-review` link (owner verified server-side). */
type WithAccessToken = { accessToken: string | null };

export type GuestToWriteItem = WithAccessToken & {
  bookingId: string;
  propertyName: string;
  propertySlug: string;
  propertyImageUrl: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  closesAt: string;
};

export type GuestByYouItem = WithAccessToken & {
  id: string;
  bookingId: string;
  propertyName: string;
  propertySlug: string;
  starRating: number;
  reviewText: string | null;
  status: string;
  responseText: string | null;
  submittedAt: string;
  publishedAt: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type GuestAboutYouItem = WithAccessToken & {
  id: string;
  bookingId: string;
  propertyName: string;
  propertySlug: string;
  hiddenUntilYouReview: boolean;
  overallRating: number | null;
  reviewText: string | null;
  privateNote: string | null;
  wouldHostAgain: boolean | null;
  responseText: string | null;
  publishedAt: string | null;
  closesAt: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type GuestMyReviewsPage = {
  tab: GuestReviewListTab;
  reputation: GuestReputation | null;
  items: GuestToWriteItem[] | GuestByYouItem[] | GuestAboutYouItem[];
  nextCursor: string | null;
};

export async function fetchMyReviews(
  tab: GuestReviewListTab,
  cursor?: string | null
): Promise<GuestMyReviewsPage> {
  const params = new URLSearchParams({ tab });
  if (cursor) params.set('cursor', cursor);
  const payload = await guestEdge(`list-my-reviews?${params.toString()}`);
  return payload as unknown as GuestMyReviewsPage;
}

export async function respondToHostReview(input: {
  bookingId: string;
  responseText: string | null;
}): Promise<void> {
  await guestEdge('respond-to-host-review', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function reportReviewAsGuest(input: {
  reviewKind: 'guest_review' | 'host_guest_review';
  reviewId: string;
  reason: string;
  details: string;
}): Promise<void> {
  await guestEdge('report-review', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
