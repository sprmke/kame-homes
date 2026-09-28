import { assertEquals } from 'jsr:@std/assert@1';

import {
  allowedPropertyPhotoUrls,
  groundPosterFeatures,
  loadPosterPhotos,
  type PosterFactsInput,
  sanitizeVariant,
  stripBannedCopy,
} from './marketingPosterDirector.ts';

const FACTS: PosterFactsInput = {
  propertyName: 'Kame Home',
  brandName: 'Kame Home',
  location: 'Azure North, Pampanga',
  checkIn: '2:00 PM',
  checkOut: '12:00 PM',
  securityDeposit: '₱2,000',
  nightlyRate: null,
  amenities: ['WiFi', 'Swimming Pool', 'Coffee Maker'],
};

Deno.test('groundPosterFeatures drops amenities the property does not have', () => {
  assertEquals(
    groundPosterFeatures(['WiFi', 'Pool', 'Sauna', 'Rooftop bar'], 'sky-headline', FACTS, ''),
    ['WiFi', 'Pool']
  );
});

Deno.test('groundPosterFeatures accepts amenities the host named in the prompt', () => {
  assertEquals(
    groundPosterFeatures(['PS5 + games'], 'wave-duo', FACTS, 'Promote our new PS5 setup'),
    ['PS5 + games']
  );
});

Deno.test('groundPosterFeatures allows use-case labels on feature-sticker', () => {
  assertEquals(
    groundPosterFeatures(['Game nights', 'Family bonding'], 'feature-sticker', FACTS, ''),
    ['Game nights', 'Family bonding']
  );
});

Deno.test('allowedPropertyPhotoUrls reads gallery media and legacy images, skipping video', () => {
  const allowed = allowedPropertyPhotoUrls({
    media: [
      { id: '1', url: 'https://cdn.example.com/a.jpg', type: 'image' },
      { id: '2', url: 'https://cdn.example.com/b.mp4', type: 'video' },
    ],
    images: ['https://cdn.example.com/c.jpg'],
  });
  assertEquals([...allowed].sort(), [
    'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/c.jpg',
  ]);
});

Deno.test('loadPosterPhotos never fetches URLs outside the allow-list', async () => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    calls.push(String(input));
    return Promise.resolve(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/jpeg' },
      })
    );
  }) as typeof fetch;
  try {
    const result = await loadPosterPhotos(
      [
        'https://cdn.example.com/a.jpg',
        'http://169.254.169.254/latest',
        'https://evil.example/x.jpg',
      ],
      new Set(['https://cdn.example.com/a.jpg', 'http://169.254.169.254/latest'])
    );
    assertEquals(calls, ['https://cdn.example.com/a.jpg']);
    assertEquals(result.urls, ['https://cdn.example.com/a.jpg']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('stripBannedCopy clears stock phrases but keeps the rest', () => {
  assertEquals(
    stripBannedCopy({
      tagline: 'Your perfect getaway.',
      headline: 'Slow',
      chips: ['Sweet escape', 'Hot coffee'],
    }),
    { tagline: '', headline: 'Slow', chips: ['Hot coffee'] }
  );
});

Deno.test('loadPosterPhotos keeps the combined payload under the inline budget', async () => {
  const realFetch = globalThis.fetch;
  const threeMb = new Uint8Array(3 * 1024 * 1024);
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(threeMb, { headers: { 'content-type': 'image/jpeg' } })
    )) as typeof fetch;
  try {
    const urls = [1, 2, 3, 4, 5, 6].map((n) => `https://cdn.example.com/${n}.jpg`);
    const result = await loadPosterPhotos(urls, new Set(urls));
    assertEquals(result.photos.length, 4);
    assertEquals(result.urls, urls.slice(0, 4));
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('loadPosterPhotos skips non-image and failed responses', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('html.jpg')) {
      return Promise.resolve(new Response('<html>', { headers: { 'content-type': 'text/html' } }));
    }
    if (url.endsWith('404.jpg')) {
      return Promise.resolve(new Response('', { status: 404 }));
    }
    if (url.endsWith('boom.jpg')) return Promise.reject(new Error('network'));
    return Promise.resolve(
      new Response(new Uint8Array([1]), {
        headers: { 'content-type': 'image/webp' },
      })
    );
  }) as typeof fetch;
  try {
    const urls = ['html', '404', 'boom', 'ok'].map((n) => `https://cdn.example.com/${n}.jpg`);
    const result = await loadPosterPhotos(urls, new Set(urls));
    assertEquals(result.urls, ['https://cdn.example.com/ok.jpg']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test('sanitizeVariant drops photo indexes the model never saw and forces the goal', () => {
  const variant = sanitizeVariant(
    {
      archetype: 'sky-headline',
      goal: 'promo',
      photoIndexes: [0, 5, -1, 1.5, 1],
      features: ['WiFi', 'Sauna'],
      copy: { headline: 'Slow', tagline: 'Sweet escape' },
    },
    {
      organizationId: 'o',
      propertyId: 'p',
      goal: 'vibe',
      prompt: '',
      facts: FACTS,
      brandColor: null,
      photos: [
        { url: 'https://a/0.jpg', mimeType: 'image/jpeg', data: '' },
        { url: 'https://a/1.jpg', mimeType: 'image/jpeg', data: '' },
      ],
      count: 4,
    }
  );
  assertEquals(variant.goal, 'vibe');
  assertEquals(variant.photoIndexes, [0, 1]);
  assertEquals(variant.features, [{ label: 'WiFi' }]);
  assertEquals(variant.copy, { headline: 'Slow', tagline: '' });
});
