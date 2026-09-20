import { useQuery } from '@tanstack/react-query';

import { usePreviewOverride } from '@/features/guest/lib/previewOverrideContext';
import { mockProperties } from '@/features/guest/marketing/properties/data/mockProperties';
import { getPropertyDetail } from '@/features/guest/marketing/properties/data/mockPropertyDetail';
import {
  mapApiPropertyToResolved,
  mapBasicMockToResolved,
  mapMockPropertyToResolved,
} from '@/features/guest/marketing/properties/lib/mapPublicPropertyDetail';
import type {
  PublicPropertyDetailDto,
  ResolvedPropertyDetail,
} from '@/features/guest/marketing/properties/types/publicProperty';
import { mapShowcaseData } from '@/features/guest/marketing/showcase/lib/mapShowcaseData';
import {
  defaultPropertyShowcaseConfig,
  type ShowcaseData,
} from '@/features/guest/marketing/showcase/types/showcase';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const PUBLIC_SHOWCASE_QUERY_KEY = ['public-showcase'] as const;

type ShowcaseApiPayload = {
  published: boolean;
  planAccessDenied?: boolean;
  templateKey?: string;
  config?: unknown;
  property?: PublicPropertyDetailDto;
  guestContact?: {
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    facebookUrl?: string | null;
    airbnbUrl?: string | null;
    instagramUrl?: string | null;
    tiktokUrl?: string | null;
  };
};

export type FetchedShowcase =
  { status: 'ok'; data: ShowcaseData } | { status: 'planAccessDenied' } | { status: 'unavailable' };

function resolveMockProperty(slug: string): ResolvedPropertyDetail | null {
  const detail = getPropertyDetail(slug);
  if (detail) return mapMockPropertyToResolved(detail);
  const basic = mockProperties.find((entry) => entry.slug === slug || entry.id === slug);
  if (basic) return mapBasicMockToResolved(basic);
  return null;
}

function mockShowcase(slug: string, published = true): ShowcaseData | null {
  const property = resolveMockProperty(slug);
  if (!property) return null;
  const config = defaultPropertyShowcaseConfig();
  config.published = published;
  return mapShowcaseData({
    property,
    config,
    templateKey: 'showcase-aurora',
    previewPlaceholders: true,
  });
}

function isPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('embed') === '1' || params.get('preview') === '1';
}

/** Host session JWT proving property access — see get-public-showcase's admin_jwt check. */
function readAdminJwtFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('admin_jwt');
}

async function fetchShowcase(slug: string, preview: boolean): Promise<FetchedShowcase> {
  const params = new URLSearchParams({ property: slug });
  if (preview) params.set('preview', '1');
  const adminJwt = preview ? readAdminJwtFromLocation() : null;
  if (adminJwt) params.set('admin_jwt', adminJwt);
  const res = await fetch(`${FUNCTIONS_URL}/get-public-showcase?${params}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  if (res.status === 404) {
    const mock = mockShowcase(slug);
    return mock ? { status: 'ok', data: mock } : { status: 'unavailable' };
  }

  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: ShowcaseApiPayload;
  };

  if (!json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to load showcase');
  }

  const payload = json.data;
  if (payload.planAccessDenied) {
    return { status: 'planAccessDenied' };
  }

  if (!payload.published && !preview) {
    const unpublished = mockShowcase(slug, false);
    if (unpublished) return { status: 'ok', data: { ...unpublished, published: false } };
    return { status: 'unavailable' };
  }

  if (!payload.property) {
    const mock = mockShowcase(slug, payload.published);
    return mock ? { status: 'ok', data: mock } : { status: 'unavailable' };
  }

  const property = mapApiPropertyToResolved(payload.property);
  const guestContact = payload.guestContact
    ? {
        contactName: payload.guestContact.contactName,
        contactPhone: payload.guestContact.contactPhone,
        contactEmail: payload.guestContact.contactEmail,
        socialLinks: {
          facebookUrl: payload.guestContact.facebookUrl ?? null,
          airbnbUrl: payload.guestContact.airbnbUrl ?? null,
          instagramUrl: payload.guestContact.instagramUrl ?? null,
          tiktokUrl: payload.guestContact.tiktokUrl ?? null,
        },
      }
    : undefined;

  return {
    status: 'ok',
    data: mapShowcaseData({
      property,
      config: payload.config ?? defaultPropertyShowcaseConfig(),
      templateKey: payload.templateKey ?? 'showcase-aurora',
      guestContact,
      ...(preview || !payload.published ? { previewPlaceholders: true as const } : {}),
    }),
  };
}

export function useShowcaseData(propertySlug: string) {
  const override = usePreviewOverride();
  const preview = isPreviewMode();

  const showcaseOverride =
    override?.kind === 'property-showcase'
      ? mapShowcaseData({
          property: override.data,
          config: override.showcaseConfig,
          templateKey: override.templateKey,
          previewPlaceholders: true,
        })
      : null;

  const query = useQuery({
    queryKey: [...PUBLIC_SHOWCASE_QUERY_KEY, propertySlug, preview],
    queryFn: () => fetchShowcase(propertySlug, preview),
    enabled: Boolean(propertySlug) && !showcaseOverride,
    staleTime: 60_000,
  });

  if (showcaseOverride) {
    return {
      data: showcaseOverride,
      planAccessDenied: false,
      isLoading: false,
      isError: false,
      error: null,
      isSuccess: true,
    };
  }

  const fetched = query.data;
  return {
    data: fetched?.status === 'ok' ? fetched.data : undefined,
    planAccessDenied: fetched?.status === 'planAccessDenied',
    isLoading: query.isLoading,
    isError: query.isError || fetched?.status === 'unavailable',
    error: query.error,
    isSuccess: query.isSuccess,
  };
}
