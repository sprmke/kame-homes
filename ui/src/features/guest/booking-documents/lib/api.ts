const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type GuestBookingDocumentDto = {
  url: string;
  label: string;
};

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error?: string; message?: string };

export async function fetchGuestBookingDocument(
  propertySlug: string,
  token: string,
  doc: 'gaf' | 'pet'
): Promise<GuestBookingDocumentDto> {
  const params = new URLSearchParams({ token, doc, property: propertySlug });
  const res = await fetch(`${FUNCTIONS_URL}/get-guest-booking-document?${params.toString()}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  const json = (await res.json()) as ApiSuccess<GuestBookingDocumentDto> | ApiError;
  if (!res.ok || !json.success) {
    throw new Error(('message' in json && json.message) || 'This link is not available.');
  }
  return json.data;
}
