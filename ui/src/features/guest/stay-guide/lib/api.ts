import type { StayGuideConfigV2 } from '@/features/guest/stay-guide/lib/stayGuideConfig';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Legacy v1 config shape — kept for migration/backfill reference only. Runtime uses `StayGuideConfigV2`. */
export type StayGuideChapterConfig = {
  id: 'getting-in' | 'make-yourself-at-home' | 'before-you-go';
  visible: boolean;
  order: number;
  accentColor: string | null;
};

export type StayGuideSectionConfig = {
  version: 1;
  hero: { visible: boolean };
  stayPassCard: { visible: boolean };
  checkInDocuments: { visible: boolean };
  galleryCarousel: { visible: boolean };
  quickNavTabs: { visible: boolean };
  chapters: StayGuideChapterConfig[];
  helpSection: { visible: boolean };
};

export type StayGuideSectionDto = {
  key: string;
  label: string;
  displayHeading: string;
  html: string;
  imageUrl: string | null;
  /** Template row `updated_at` — cache-busts fixed storage paths after replace. */
  imageUpdatedAt?: string | null;
};

export type StayGuideCheckInDocumentDto = {
  id: string;
  label: string;
  kind: 'gaf' | 'pet' | 'parking' | 'other';
  status: 'ready' | 'pending';
  url: string | null;
  /** Admin preview only — ready chrome without a real file. */
  isPreviewSample?: boolean;
};

export type GuestStayGuideDto = {
  property: {
    slug: string;
    name: string;
    brandColor: string;
    logoUrl: string | null;
    locationLabel: string;
    towerAndUnit: string | null;
    location: {
      address: string;
      city: string;
      province: string | null;
      country: string;
      zipCode: string | null;
      latitude: number | null;
      longitude: number | null;
      placeId: string | null;
      mapsUrl: string | null;
    };
    heroImageUrl: string | null;
    galleryImages: string[];
    images: string[];
  };
  booking: {
    guestName: string;
    checkInDate: string;
    checkOutDate: string;
    checkInTime: string;
    checkOutTime: string;
    needParking: boolean;
    hasPets: boolean;
  };
  contact: {
    phone: string;
    email: string;
    facebookUrl: string;
    airbnbUrl: string;
  };
  host: {
    name: string;
    avatarUrl: string | null;
    organizationName: string;
  };
  sections: StayGuideSectionDto[];
  /** Present on current API; older responses may omit. */
  checkInDocuments?: StayGuideCheckInDocumentDto[];
  validUntil: string;
  todayManila: string;
  /** One of the 6 `showcase-*` template keys (Stay Guide shares the Showcase engine). */
  templateKey: string;
  /** v2 page config (palette / typography / motion + flat sections[]). v1 rows upgrade on read. */
  sectionConfig?: StayGuideConfigV2;
};

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error?: string; message?: string };

export async function fetchGuestStayGuide(
  propertySlug: string,
  token: string
): Promise<GuestStayGuideDto> {
  const params = new URLSearchParams({
    token,
    property: propertySlug,
  });
  const res = await fetch(`${FUNCTIONS_URL}/get-guest-stay-guide?${params.toString()}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  const json = (await res.json()) as ApiSuccess<GuestStayGuideDto> | ApiError;
  if (!res.ok || !json.success) {
    throw new Error(
      ('message' in json && json.message) ||
        ('error' in json && json.error) ||
        'This stay guide is not available right now.'
    );
  }
  return json.data;
}
