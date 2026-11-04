import { DEFAULT_PUBLIC_GUEST_APP_ORIGIN, resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';

Deno.test('default public guest origin is kamespace.com', () => {
  if (DEFAULT_PUBLIC_GUEST_APP_ORIGIN !== 'https://kamespace.com') {
    throw new Error(`expected https://kamespace.com, got ${DEFAULT_PUBLIC_GUEST_APP_ORIGIN}`);
  }
});

Deno.test('resolvePublicGuestAppOrigin prefers env then db then default', () => {
  const prev = Deno.env.get('PUBLIC_GUEST_APP_ORIGIN');
  try {
    Deno.env.set('PUBLIC_GUEST_APP_ORIGIN', 'https://env.example/');
    if (resolvePublicGuestAppOrigin('https://db.example') !== 'https://env.example') {
      throw new Error('env should win');
    }
    Deno.env.delete('PUBLIC_GUEST_APP_ORIGIN');
    if (resolvePublicGuestAppOrigin('https://db.example/') !== 'https://db.example') {
      throw new Error('db should win when env unset');
    }
    if (resolvePublicGuestAppOrigin() !== 'https://kamespace.com') {
      throw new Error('default should be kamespace.com');
    }
  } finally {
    if (prev === undefined) Deno.env.delete('PUBLIC_GUEST_APP_ORIGIN');
    else Deno.env.set('PUBLIC_GUEST_APP_ORIGIN', prev);
  }
});
