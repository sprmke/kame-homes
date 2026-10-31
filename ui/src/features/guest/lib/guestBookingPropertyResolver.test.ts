import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveBookingPropertySlug } from '@/features/guest/lib/guestBookingPropertyResolver';

const UUID = '11111111-2222-3333-4444-555555555555';
const NOT_A_UUID = 'KM-REF-123';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function stubFetch(payload: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status: ok ? 200 : 404 }))
  );
}

describe('resolveBookingPropertySlug', () => {
  it('returns null immediately for a non-UUID booking id (no fetch)', async () => {
    stubFetch({ success: true, data: { property_slug: 'monaco-2604' } });
    const slug = await resolveBookingPropertySlug(NOT_A_UUID);
    expect(slug).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the slug on a success payload', async () => {
    stubFetch({ success: true, data: { property_slug: 'monaco-2604' } });
    const slug = await resolveBookingPropertySlug(UUID);
    expect(slug).toBe('monaco-2604');
  });

  it('returns null on a 404 / not-found payload', async () => {
    stubFetch({ success: false, error: 'Booking not found' }, false);
    const slug = await resolveBookingPropertySlug(UUID);
    expect(slug).toBeNull();
  });

  it('returns null on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    const slug = await resolveBookingPropertySlug(UUID);
    expect(slug).toBeNull();
  });

  it('returns null when slug is blank', async () => {
    stubFetch({ success: true, data: { property_slug: '   ' } });
    const slug = await resolveBookingPropertySlug(UUID);
    expect(slug).toBeNull();
  });
});
