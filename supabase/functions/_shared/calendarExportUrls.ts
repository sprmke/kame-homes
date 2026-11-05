/**
 * Public outbound calendar feed URLs for Channel sync → OTA import.
 *
 * Airbnb (and similar OTAs) require the path to end in `.ics` before the query
 * string — their UI rejects bare `/ical-export?…` links. Hosted edge often
 * sees `http://` on `req.url` even when clients call HTTPS; public paste URLs
 * must use the project HTTPS origin.
 */

export type CalendarExportUrlMap = {
  all: string;
  airbnb: string;
  booking_com: string;
  vrbo: string;
};

/** Path segment Airbnb validates as "ends in .ics". Extra segments still hit `ical-export`. */
export const CALENDAR_EXPORT_ICS_PATH = '/functions/v1/ical-export/calendar.ics';

/**
 * Origin hosts should paste into OTAs. Prefer `SUPABASE_URL`; always force https
 * for `*.supabase.co` so Airbnb does not hit a 301 HTML redirect.
 */
export function resolvePublicExportOrigin(
  req: Request,
  envSupabaseUrl: string | undefined = Deno.env.get('SUPABASE_URL')
): string {
  const candidates = [envSupabaseUrl?.trim(), new URL(req.url).origin].filter(
    (v): v is string => !!v
  );
  for (const raw of candidates) {
    try {
      const u = new URL(raw);
      if (u.hostname.endsWith('.supabase.co') || u.hostname === 'supabase.co') {
        u.protocol = 'https:';
      }
      return u.origin;
    } catch {
      /* try next */
    }
  }
  return new URL(req.url).origin;
}

export function buildCalendarExportUrls(
  origin: string,
  propertySlug: string,
  token: string
): CalendarExportUrlMap {
  const base =
    `${origin.replace(/\/$/, '')}${CALENDAR_EXPORT_ICS_PATH}` +
    `?property=${encodeURIComponent(propertySlug)}` +
    `&token=${encodeURIComponent(token)}`;
  return {
    all: base,
    airbnb: `${base}&as=airbnb`,
    booking_com: `${base}&as=booking_com`,
    vrbo: `${base}&as=vrbo`,
  };
}
