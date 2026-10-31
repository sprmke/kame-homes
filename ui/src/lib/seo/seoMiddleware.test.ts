import { describe, expect, it, vi } from 'vitest';

import { handleSeoRequest } from '@/lib/seo/seoMiddleware';

const SHELL =
  '<html><head><title>Kame Homes</title></head><body><div id="root"></div></body></html>';
const BOT = 'facebookexternalhit/1.1';
const BROWSER = 'Mozilla/5.0 (iPhone) Safari/604.1';

function req(path: string, ua = BOT, method = 'GET') {
  return new Request(`https://kamehomes.space${path}`, { method, headers: { 'user-agent': ua } });
}

function deps(fetchImpl: typeof fetch) {
  return {
    functionsUrl: 'https://abc.supabase.co/functions/v1/',
    anonKey: 'anon',
    siteName: 'Kame Homes',
    fetchImpl,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const shell = () => Promise.resolve(SHELL);

describe('handleSeoRequest', () => {
  it('serves robots.txt with the request origin sitemap', async () => {
    const res = await handleSeoRequest(req('/robots.txt', BROWSER), deps(vi.fn()), shell);
    expect(await res!.text()).toContain('Sitemap: https://kamehomes.space/sitemap.xml');
  });

  it('proxies sitemap.xml (with part param) and passes through on upstream failure', async () => {
    const fetchOk = vi.fn().mockResolvedValue(new Response('<urlset/>', { status: 200 }));
    const res = await handleSeoRequest(req('/sitemap.xml?part=2', BROWSER), deps(fetchOk), shell);
    expect(await res!.text()).toBe('<urlset/>');
    expect(fetchOk.mock.calls[0]![0]).toBe(
      'https://abc.supabase.co/functions/v1/public-sitemap?part=2'
    );

    const fetchFail = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    expect(await handleSeoRequest(req('/sitemap.xml', BROWSER), deps(fetchFail), shell)).toBeNull();
  });

  it('passes browsers through untouched', async () => {
    const fetchImpl = vi.fn();
    expect(
      await handleSeoRequest(req('/properties/monaco-2612', BROWSER), deps(fetchImpl), shell)
    ).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('injects property meta for crawlers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          name: 'Monaco 2612',
          description: null,
          locationLabel: 'San Fernando, Pampanga',
          images: ['https://img/a.jpg'],
          city: 'San Fernando',
          rating: 4.8,
          reviewCount: 8,
          pricing: { weekdayNightlyRate: 2500 },
        },
      })
    );
    const res = await handleSeoRequest(req('/properties/monaco-2612/'), deps(fetchImpl), shell);
    const html = await res!.text();
    expect(res!.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<title>Kame Homes - Monaco 2612</title>');
    expect(html).toContain('og:image" content="https://img/a.jpg"');
    expect(html).toContain('href="https://kamehomes.space/properties/monaco-2612"');
    expect(html).toContain('"@type":"LodgingBusiness"');
    expect(html).toContain('"reviewCount":8');
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://abc.supabase.co/functions/v1/get-public-property?property=monaco-2612'
    );
  });

  it('handles parking and development detail pages', async () => {
    const parkingFetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { name: 'Slot A1', residenceName: 'Azure North', ratePerNight: 300 } })
      );
    const parking = await handleSeoRequest(req('/parkings/slot-a1'), deps(parkingFetch), shell);
    expect(await parking!.text()).toContain('Parking at Azure North');

    const devFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [{ name: 'Azure North', city: 'San Fernando' }] }));
    const dev = await handleSeoRequest(req('/developments/azure-north'), deps(devFetch), shell);
    expect(await dev!.text()).toContain('"@type":"Residence"');
  });

  it('fails open on unknown listings, errors, non-GET, and non-detail paths', async () => {
    const notFound = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 404));
    expect(await handleSeoRequest(req('/properties/missing'), deps(notFound), shell)).toBeNull();

    const boom = vi.fn().mockRejectedValue(new Error('network'));
    expect(await handleSeoRequest(req('/properties/x'), deps(boom), shell)).toBeNull();

    const ok = vi.fn().mockResolvedValue(jsonResponse({ data: { name: 'x' } }));
    expect(await handleSeoRequest(req('/properties/x', BOT, 'HEAD'), deps(ok), shell)).toBeNull();
    expect(await handleSeoRequest(req('/properties/in/makati'), deps(ok), shell)).toBeNull();
    expect(
      await handleSeoRequest(req('/properties/x'), deps(ok), () => Promise.resolve(null))
    ).toBeNull();
  });
});
