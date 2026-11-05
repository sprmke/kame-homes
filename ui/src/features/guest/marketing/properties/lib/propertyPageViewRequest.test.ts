import { describe, expect, it } from 'vitest';

import { buildPropertyPageViewRequest } from './propertyPageViewRequest';

describe('buildPropertyPageViewRequest', () => {
  const payload = { propertyId: 'p-1', sessionId: 's-1', utmSource: 'fb' };

  it('posts to property-page-view without credentials so CORS accepts it', () => {
    const [url, init] = buildPropertyPageViewRequest('https://x.supabase.co/functions/v1/', 'anon', payload);
    expect(url).toBe('https://x.supabase.co/functions/v1/property-page-view');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.keepalive).toBe(true);
  });

  it('sends the anon key as headers, not in the URL', () => {
    const [url, init] = buildPropertyPageViewRequest('https://x.supabase.co/functions/v1', 'anon', payload);
    expect(url).not.toContain('apikey');
    expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer anon' });
  });

  it('serializes the payload as JSON', () => {
    const [, init] = buildPropertyPageViewRequest('https://x.supabase.co/functions/v1', 'anon', payload);
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });
});
