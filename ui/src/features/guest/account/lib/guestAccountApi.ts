import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type EdgeJson = {
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

function unwrapEdgePayload(json: EdgeJson): Record<string, unknown> {
  if (!json.success) throw new Error(json.error ?? 'Request failed');
  const payload = json.data;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }
  return json as Record<string, unknown>;
}

async function guestJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required.');
  return token;
}

async function guestEdgeGet(path: string, search?: URLSearchParams) {
  const jwt = await guestJwt();
  const qs = search?.toString();
  const res = await fetch(`${FUNCTIONS_URL}/${path}${qs ? `?${qs}` : ''}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  const json = (await res.json()) as EdgeJson;
  return unwrapEdgePayload(json);
}

async function guestEdgePatch(path: string, body: Record<string, unknown>) {
  const jwt = await guestJwt();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as EdgeJson;
  return unwrapEdgePayload(json);
}

async function guestEdgePostForm(path: string, formData: FormData) {
  const jwt = await guestJwt();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });
  const json = (await res.json()) as EdgeJson;
  return unwrapEdgePayload(json);
}

export type GuestProfileDto = {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  phone: string | null;
  locationLabel: string | null;
  email: string;
};

export type GuestMessageThreadDto = {
  conversationId: string;
  propertySlug: string | null;
  propertyName: string | null;
  propertyImageUrl: string | null;
  parkingSlug: string | null;
  parkingName: string | null;
  parkingImageUrl: string | null;
  hostName: string | null;
  hostAvatarUrl: string | null;
  inquiryCheckIn: string | null;
  inquiryCheckOut: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  replyStatus: string | null;
};

export const GUEST_PROFILE_QUERY_KEY = ['guest-profile'] as const;
export const GUEST_MESSAGES_QUERY_KEY = ['guest-messages'] as const;
export const GUEST_VOUCHERS_QUERY_KEY = ['guest-vouchers'] as const;

export type GuestVoucherDto = {
  sourceBookingId: string;
  code: string;
  percentOff: number;
  legacyAmountPhp: number | null;
  awardedAt: string | null;
  checkInDate: string;
  checkOutDate: string;
  propertyId: string | null;
  propertySlug: string | null;
  propertyName: string | null;
  propertyImageUrl: string | null;
  redeemedAt: string | null;
  redeemedBookingId: string | null;
};

export async function fetchGuestVouchers(opts?: {
  propertyId?: string;
  propertySlug?: string;
  includeRedeemed?: boolean;
}): Promise<GuestVoucherDto[]> {
  const search = new URLSearchParams();
  if (opts?.propertyId) search.set('propertyId', opts.propertyId);
  else if (opts?.propertySlug) search.set('property', opts.propertySlug);
  if (opts?.includeRedeemed) search.set('includeRedeemed', '1');
  const payload = await guestEdgeGet('list-guest-vouchers', search);
  return (payload.vouchers as GuestVoucherDto[] | undefined) ?? [];
}

export async function fetchGuestProfile(): Promise<GuestProfileDto> {
  const payload = await guestEdgeGet('guest-profile');
  return payload as unknown as GuestProfileDto;
}

export type GuestProfilePatch = {
  displayName?: string;
  bio?: string | null;
  phone?: string | null;
  locationLabel?: string | null;
  avatarUrl?: string | null;
};

export async function patchGuestProfile(patch: GuestProfilePatch): Promise<GuestProfileDto> {
  const payload = await guestEdgePatch('guest-profile', patch);
  return payload as unknown as GuestProfileDto;
}

export async function uploadGuestProfileAvatar(file: File): Promise<{ avatarUrl: string }> {
  const prepared = await prepareUpload(file, {
    imagePreset: 'AVATAR',
    surface: 'guest-profile-avatar',
  });
  if (prepared.error) throw new Error(prepared.error);

  const formData = new FormData();
  formData.append('file', prepared.file);
  formData.append('fileName', prepared.file.name);
  const payload = await guestEdgePostForm('upload-guest-profile-asset', formData);
  return { avatarUrl: String(payload.avatarUrl ?? '') };
}

export async function fetchGuestMessages(): Promise<{ threads: GuestMessageThreadDto[] }> {
  const payload = await guestEdgeGet('guest-messages');
  return {
    threads: (payload.threads as GuestMessageThreadDto[] | undefined) ?? [],
  };
}

export const GUEST_TRIPS_QUERY_KEY = ['guest-trips'] as const;

/** Property bookings for the signed-in guest (`guest-trips`), newest check-in first. */
export type GuestTripListItemDto = {
  id: string;
  status: string;
  /** YYYY-MM-DD */
  checkInDate: string;
  /** YYYY-MM-DD */
  checkOutDate: string;
  propertySlug: string | null;
  propertyName: string | null;
  imageUrl: string | null;
  guestFacebookName: string | null;
};

export async function fetchGuestTrips(): Promise<GuestTripListItemDto[]> {
  const payload = await guestEdgeGet('guest-trips');
  return (payload.trips as GuestTripListItemDto[] | undefined) ?? [];
}
