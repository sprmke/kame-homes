import { verifyCronSecret } from './cronSecretGate.ts';

function reqWithHeader(name: string, value: string): Request {
  return new Request('https://example.test/cron', {
    headers: { [name]: value },
  });
}

Deno.test('verifyCronSecret fail-open when unset on non-production', () => {
  Deno.env.delete('SD_REFUND_CRON_SECRET');
  Deno.env.set('ENVIRONMENT', 'development');
  const ok = verifyCronSecret(new Request('https://example.test/cron'), {
    envKey: 'SD_REFUND_CRON_SECRET',
    headerName: 'x-sd-refund-cron-secret',
  });
  if (!ok) throw new Error('expected fail-open on dev');
});

Deno.test('verifyCronSecret fail-closed when unset on production', () => {
  Deno.env.delete('SD_REFUND_CRON_SECRET');
  Deno.env.set('ENVIRONMENT', 'production');
  const ok = verifyCronSecret(new Request('https://example.test/cron'), {
    envKey: 'SD_REFUND_CRON_SECRET',
    headerName: 'x-sd-refund-cron-secret',
  });
  if (ok) throw new Error('expected fail-closed on prod');
});

Deno.test('verifyCronSecret requires matching header when secret set', () => {
  Deno.env.set('SD_REFUND_CRON_SECRET', 'sekret');
  Deno.env.set('ENVIRONMENT', 'production');
  const bad = verifyCronSecret(new Request('https://example.test/cron'), {
    envKey: 'SD_REFUND_CRON_SECRET',
    headerName: 'x-sd-refund-cron-secret',
  });
  if (bad) throw new Error('expected reject without header');
  const good = verifyCronSecret(reqWithHeader('x-sd-refund-cron-secret', 'sekret'), {
    envKey: 'SD_REFUND_CRON_SECRET',
    headerName: 'x-sd-refund-cron-secret',
  });
  if (!good) throw new Error('expected accept with header');
});
