import {
  collectRemoteImageUrls,
  extractEmailAddress,
  hostnameFromEmailOrUrl,
  isTrustedEmailImageHost,
  resolveTrustedEmailImageHosts,
} from './emailInlineRemoteImages.ts';

Deno.test('extractEmailAddress parses angled and bare forms', () => {
  if (extractEmailAddress('Kame <mail@kamespace.com>') !== 'mail@kamespace.com') {
    throw new Error('angled From failed');
  }
  if (extractEmailAddress('mail@kamespace.com') !== 'mail@kamespace.com') {
    throw new Error('bare From failed');
  }
  if (extractEmailAddress('not-an-email') !== null) {
    throw new Error('expected null for invalid');
  }
});

Deno.test('hostnameFromEmailOrUrl reads From and absolute URLs', () => {
  if (hostnameFromEmailOrUrl('Acme <hello@mail.kamespace.com>') !== 'mail.kamespace.com') {
    throw new Error('From hostname failed');
  }
  if (hostnameFromEmailOrUrl('https://kamespace.com/images/logo.png') !== 'kamespace.com') {
    throw new Error('URL hostname failed');
  }
});

Deno.test('trusted hosts include From + app origin parent/child matches', () => {
  const prevOrigin = Deno.env.get('PUBLIC_GUEST_APP_ORIGIN');
  const prevFrom = Deno.env.get('RESEND_FROM_EMAIL');
  try {
    Deno.env.set('PUBLIC_GUEST_APP_ORIGIN', 'https://kamespace.com');
    Deno.env.set('RESEND_FROM_EMAIL', 'mail@kamespace.com');
    const trusted = resolveTrustedEmailImageHosts('Org <mail@kamespace.com>');
    if (!isTrustedEmailImageHost('kamespace.com', trusted)) {
      throw new Error('apex should be trusted');
    }
    if (!isTrustedEmailImageHost('www.kamespace.com', trusted)) {
      throw new Error('www should be trusted');
    }
    if (isTrustedEmailImageHost('fworvijbrwpyngycotbz.supabase.co', trusted)) {
      throw new Error('supabase host must not be trusted');
    }
  } finally {
    if (prevOrigin === undefined) Deno.env.delete('PUBLIC_GUEST_APP_ORIGIN');
    else Deno.env.set('PUBLIC_GUEST_APP_ORIGIN', prevOrigin);
    if (prevFrom === undefined) Deno.env.delete('RESEND_FROM_EMAIL');
    else Deno.env.set('RESEND_FROM_EMAIL', prevFrom);
  }
});

Deno.test('collectRemoteImageUrls finds img src and css url()', () => {
  const html = `
    <img src="https://cdn.example.com/a.png" />
    <img src='cid:already' />
    <td style="background:url('https://cdn.example.com/b.jpg') center;"></td>
    <img src="data:image/png;base64,aaa" />
  `;
  const urls = collectRemoteImageUrls(html);
  if (urls.length !== 2) throw new Error(`expected 2 urls, got ${urls.length}: ${urls.join(',')}`);
  if (!urls.includes('https://cdn.example.com/a.png')) throw new Error('missing a.png');
  if (!urls.includes('https://cdn.example.com/b.jpg')) throw new Error('missing b.jpg');
});
