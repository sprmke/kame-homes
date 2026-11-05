import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FEATURE_AVAILABILITY_CATALOG as CLIENT_CATALOG,
  FEATURE_AVAILABILITY_KEYS as CLIENT_KEYS,
  FEATURE_AVAILABILITY_REASON_COPY as CLIENT_REASON_COPY,
} from '@/lib/featureAvailability/featureAvailabilityCatalog';
import { resolveFeatureAvailability as clientResolve } from '@/lib/featureAvailability/resolveFeatureAvailability';

import {
  FEATURE_AVAILABILITY_CATALOG as SERVER_CATALOG,
  FEATURE_AVAILABILITY_KEYS as SERVER_KEYS,
  FEATURE_AVAILABILITY_REASON_COPY as SERVER_REASON_COPY,
} from '../../../../supabase/functions/_shared/featureAvailabilityCatalog.ts';
import { resolveFeatureAvailability as serverResolve } from '../../../../supabase/functions/_shared/featureAvailabilityResolve.ts';

const ROOT = resolve(import.meta.dirname, '../../../..');

describe('feature availability catalog parity', () => {
  it('keys match', () => {
    expect([...CLIENT_KEYS]).toEqual([...SERVER_KEYS]);
  });

  it('catalog entries match', () => {
    expect(CLIENT_CATALOG).toEqual(SERVER_CATALOG);
  });

  it('reason copy matches', () => {
    expect(CLIENT_REASON_COPY).toEqual(SERVER_REASON_COPY);
  });

  it('resolver output matches for a mixed fixture', () => {
    const now = new Date('2026-10-28T10:00:00.000Z');
    const rows = [
      {
        feature_key: 'inbox.meta',
        is_enabled: false,
        reason: 'maintenance',
        message: null,
        expected_back_at: '2026-10-28T14:00:00.000Z',
        auto_restore: false,
        show_banner: true,
        super_admin_bypass: true,
      },
      {
        feature_key: 'pricing.channel_sync.import',
        is_enabled: false,
        reason: 'paused',
        message: null,
        expected_back_at: null,
        auto_restore: false,
        show_banner: false,
        super_admin_bypass: true,
      },
    ];
    const client = clientResolve(CLIENT_CATALOG, rows, now);
    const server = serverResolve(SERVER_CATALOG, rows, now);
    for (const key of CLIENT_KEYS) {
      expect(client.get(key)).toEqual(server.get(key));
    }
  });

  it('server and client catalog sources stay byte-aligned on keys export', () => {
    const serverSource = readFileSync(
      resolve(ROOT, 'supabase/functions/_shared/featureAvailabilityCatalog.ts'),
      'utf8'
    );
    const clientSource = readFileSync(
      resolve(ROOT, 'ui/src/lib/featureAvailability/featureAvailabilityCatalog.ts'),
      'utf8'
    );
    const extractKeys = (source: string) =>
      source.match(/export const FEATURE_AVAILABILITY_KEYS = \[([\s\S]*?)\] as const/)?.[1] ?? '';
    expect(extractKeys(clientSource).replace(/\s+/g, ' ')).toBe(
      extractKeys(serverSource).replace(/\s+/g, ' ')
    );
  });
});
