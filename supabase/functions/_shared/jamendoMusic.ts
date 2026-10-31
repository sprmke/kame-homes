/**
 * Jamendo API v3 — free-tier music search for marketing video backgrounds.
 * Register a client id at https://devportal.jamendo.com/
 */

const JAMENDO_API = 'https://api.jamendo.com/v3.0';

export type JamendoTrack = {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  imageUrl: string | null;
  streamUrl: string;
  downloadUrl: string;
};

export function readJamendoClientId(): string | null {
  const id = Deno.env.get('JAMENDO_CLIENT_ID')?.trim();
  return id || null;
}

type JamendoApiTrack = {
  id?: string | number;
  name?: string;
  artist_name?: string;
  duration?: number;
  album_image?: string;
  image?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
};

type JamendoApiResponse = {
  headers?: {
    status?: string;
    error_message?: string;
    code?: number;
  };
  results?: JamendoApiTrack[];
};

export class JamendoApiError extends Error {
  readonly code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'JamendoApiError';
    this.code = code;
  }
}

function parseJamendoResponse(json: JamendoApiResponse): JamendoApiTrack[] {
  const status = json.headers?.status?.trim().toLowerCase();
  if (status && status !== 'success') {
    throw new JamendoApiError(
      json.headers?.error_message?.trim() || 'Jamendo request failed',
      json.headers?.code
    );
  }

  return Array.isArray(json.results) ? json.results : [];
}

function mapJamendoTrack(row: JamendoApiTrack): JamendoTrack | null {
  const id = row.id != null ? String(row.id) : '';
  const streamUrl = typeof row.audio === 'string' ? row.audio.trim() : '';
  const downloadUrl = typeof row.audiodownload === 'string' ? row.audiodownload.trim() : '';
  if (!id || !streamUrl) return null;

  return {
    id,
    title: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Untitled',
    artist:
      typeof row.artist_name === 'string' && row.artist_name.trim()
        ? row.artist_name.trim()
        : 'Unknown artist',
    durationSec:
      typeof row.duration === 'number' && Number.isFinite(row.duration)
        ? Math.max(0, Math.round(row.duration))
        : 0,
    imageUrl:
      typeof row.album_image === 'string'
        ? row.album_image
        : typeof row.image === 'string'
          ? row.image
          : null,
    streamUrl,
    downloadUrl: downloadUrl || streamUrl,
  };
}

export async function fetchJamendoTracks(params: {
  clientId: string;
  search?: string;
  order?: 'popularity_week' | 'popularity_total' | 'relevance';
  limit?: number;
  offset?: number;
}): Promise<JamendoTrack[]> {
  const url = new URL(`${JAMENDO_API}/tracks/`);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(Math.min(30, Math.max(1, params.limit ?? 20))));
  url.searchParams.set('offset', String(Math.max(0, params.offset ?? 0)));
  url.searchParams.set('audioformat', 'mp32');
  url.searchParams.set('include', 'musicinfo');
  url.searchParams.set('order', params.order ?? 'popularity_week');

  const search = params.search?.trim();
  if (search) {
    url.searchParams.set('search', search);
    if (!params.order) url.searchParams.set('order', 'relevance');
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Jamendo request failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`
    );
  }

  const json = (await res.json()) as JamendoApiResponse;
  const rows = parseJamendoResponse(json);
  return rows.map(mapJamendoTrack).filter((track): track is JamendoTrack => track !== null);
}

export async function fetchJamendoTrackById(
  clientId: string,
  trackId: string
): Promise<JamendoTrack | null> {
  const url = new URL(`${JAMENDO_API}/tracks/`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('format', 'json');
  url.searchParams.set('id', trackId);
  url.searchParams.set('audioformat', 'mp32');
  url.searchParams.set('include', 'musicinfo');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Jamendo track lookup failed (${res.status})`);
  }

  const json = (await res.json()) as JamendoApiResponse;
  const rows = parseJamendoResponse(json);
  const row = rows[0];
  return row ? mapJamendoTrack(row) : null;
}
