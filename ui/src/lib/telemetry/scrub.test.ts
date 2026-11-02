import { describe, expect, it } from 'vitest';

import {
  isDeniedTelemetryKey,
  scrubRecord,
  scrubUrl,
  TELEMETRY_DENY_KEYS,
  TELEMETRY_DENY_QUERY_KEYS,
} from './scrub';

describe('isDeniedTelemetryKey', () => {
  it('matches the declared deny list', () => {
    for (const key of TELEMETRY_DENY_KEYS) {
      expect(isDeniedTelemetryKey(key), key).toBe(true);
      expect(isDeniedTelemetryKey(key.toUpperCase()), key).toBe(true);
    }
  });

  it('catches credential-shaped keys by substring', () => {
    expect(isDeniedTelemetryKey('refresh_token')).toBe(true);
    expect(isDeniedTelemetryKey('X-Api-Key')).toBe(true);
    expect(isDeniedTelemetryKey('user_password_hash')).toBe(true);
    expect(isDeniedTelemetryKey('webhook_signature')).toBe(true);
    expect(isDeniedTelemetryKey('authorization_header')).toBe(true);
  });

  it('catches guest and owner display names', () => {
    expect(isDeniedTelemetryKey('guest_full_name')).toBe(true);
    expect(isDeniedTelemetryKey('owner_name')).toBe(true);
    expect(isDeniedTelemetryKey('guest_segment')).toBe(false);
    expect(isDeniedTelemetryKey('owner_id')).toBe(false);
  });

  it('keeps diagnostic keys', () => {
    expect(isDeniedTelemetryKey('step_id')).toBe(false);
    expect(isDeniedTelemetryKey('org_id')).toBe(false);
    expect(isDeniedTelemetryKey('http_status')).toBe(false);
    expect(isDeniedTelemetryKey('plan_tier')).toBe(false);
  });
});

describe('scrubRecord', () => {
  it('drops denied keys and keeps the rest', () => {
    expect(
      scrubRecord({
        step_id: 1,
        email: 'a@b.com',
        booking_source: 'Airbnb',
        guest_phone_number: '+63123456789',
      })
    ).toEqual({ step_id: 1, booking_source: 'Airbnb' });
  });

  it('drops undefined values', () => {
    expect(scrubRecord({ org_id: 'org-1', property_id: undefined })).toEqual({ org_id: 'org-1' });
  });

  it('scrubs nested objects', () => {
    expect(
      scrubRecord({
        context: { org_id: 'org-1', guest_email: 'x@y.z', token: 'abc' },
        amount_bucket: '1k-5k',
      })
    ).toEqual({ context: { org_id: 'org-1' }, amount_bucket: '1k-5k' });
  });

  it('scrubs objects inside arrays but keeps primitive arrays', () => {
    expect(
      scrubRecord({
        changed_fields: ['status', 'check_in'],
        rows: [
          { id: 'a', email: 'a@b.com' },
          { id: 'b', message: 'hello' },
        ],
      })
    ).toEqual({ changed_fields: ['status', 'check_in'], rows: [{ id: 'a' }, { id: 'b' }] });
  });

  it('converts non-plain values instead of shipping the object', () => {
    const out = scrubRecord({
      at: new Date('2026-11-01T00:00:00.000Z'),
      link: new URL('https://x.test/form?access=secret&tab=dates'),
    });
    expect(out).toEqual({ at: '2026-11-01T00:00:00.000Z', link: 'https://x.test/form?tab=dates' });
  });

  it('stops at the depth cap instead of recursing forever', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } };
    const out = scrubRecord(deep);
    expect(JSON.stringify(out)).not.toContain('"h"');
    expect(out.a).toBeDefined();
  });

  it('tolerates a missing payload', () => {
    expect(scrubRecord(undefined)).toEqual({});
  });
});

describe('scrubUrl', () => {
  it('removes every capability query param', () => {
    const url = scrubUrl(
      'https://dev.kamehomes.space/form?access=aaa&complete=bbb&token=ccc&code=ddd&state=eee&signature=fff&t=ggg&tab=dates'
    );
    expect(url).toBe('https://dev.kamehomes.space/form?tab=dates');
  });

  it('covers every declared query key', () => {
    const params = TELEMETRY_DENY_QUERY_KEYS.map((key) => `${key}=x`).join('&');
    expect(scrubUrl(`https://x.test/p?${params}&keep=1`)).toBe('https://x.test/p?keep=1');
  });

  it('keeps campaign params so analytics still work', () => {
    expect(scrubUrl('https://x.test/p?utm_source=fb&utm_campaign=launch')).toBe(
      'https://x.test/p?utm_source=fb&utm_campaign=launch'
    );
  });

  it('returns the path alone when the value is not a parseable URL', () => {
    expect(scrubUrl('/form?access=aaa')).toBe('/form');
    expect(scrubUrl('$direct')).toBe('$direct');
  });
});
