import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ASSISTANT_ROUTE_LABELS,
  assistantRouteSectionLabel,
  isOpenableAssistantHref,
} from '@/features/dashboard/ai-assistant/lib/assistantRoutes';

const SERVER_ROUTES = path.resolve(
  __dirname,
  '../../../../../../supabase/functions/_shared/dashboardAssistantRoutes.ts'
);

/** Parses `'key': { … label: 'X' … }` entries out of the server allowlist source. */
function serverRouteLabels(): Record<string, string> {
  const source = readFileSync(SERVER_ROUTES, 'utf8');
  const out: Record<string, string> = {};
  const re = /'((?:org|property|parking)\.[a-z-]+)':\s*\{[^}]*?label:\s*'([^']+)'/g;
  for (const match of source.matchAll(re)) out[match[1]] = match[2];
  return out;
}

describe('assistant route mirror', () => {
  it('matches the server allowlist keys and labels', () => {
    expect(ASSISTANT_ROUTE_LABELS).toEqual(serverRouteLabels());
  });

  it('labels known keys and rejects unknown ones', () => {
    expect(assistantRouteSectionLabel('property.finance')).toBe('Finance');
    expect(assistantRouteSectionLabel('admin.orgs')).toBeNull();
    expect(assistantRouteSectionLabel('toString')).toBeNull();
  });

  it('only opens in-app dashboard paths', () => {
    expect(isOpenableAssistantHref('/org/acme/property/loft/finance?tab=x')).toBe(true);
    expect(isOpenableAssistantHref('/org/acme')).toBe(true);
    expect(isOpenableAssistantHref('https://evil.test/org/x')).toBe(false);
    expect(isOpenableAssistantHref('//evil.test')).toBe(false);
    expect(isOpenableAssistantHref('/admin/orgs')).toBe(false);
    expect(isOpenableAssistantHref('/org/a b')).toBe(false);
  });
});
