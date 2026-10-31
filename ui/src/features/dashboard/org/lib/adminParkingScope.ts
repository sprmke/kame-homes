import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';

export function useParkingIdParam(): string {
  const { parking } = useParkingContext();
  return parking.id;
}

export function appendParkingId(params: URLSearchParams, parkingId: string) {
  params.set('parking_id', parkingId);
}

export function scopedParkingFunctionsUrl(path: string, parkingId: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const separator = normalized.includes('?') ? '&' : '?';
  return `${normalized}${separator}parking_id=${encodeURIComponent(parkingId)}`;
}

/** Full Supabase functions URL scoped to a parking slot. */
export function scopedParkingFunctionsBaseUrl(path: string, parkingId: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const sep = normalizedPath.includes('?') ? '&' : '?';
  return `${base}${normalizedPath}${sep}parking_id=${encodeURIComponent(parkingId)}`;
}
