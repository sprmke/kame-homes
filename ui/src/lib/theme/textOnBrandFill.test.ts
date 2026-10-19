import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../..');

/** Pending move to `bg-primary-strong`; remove entries as they migrate. */
const PENDING = new Set([
  'components/chat/ChatMessageBubble.tsx',
  'components/ui/button.tsx',
  'features/dashboard/bookings/components/AdminLayout.tsx',
  'features/dashboard/marketing/components/ai-studio/AiPostPanel.tsx',
  'features/dashboard/super-admin/components/shared/SuperAdminSecondaryNav.tsx',
  'features/guest/chat/components/voice/VoiceSessionPanel.tsx',
  'features/guest/marketing/for-hosts/components/HostDashboardTourPlayer.tsx',
  'features/guest/marketing/for-hosts/components/HostHowItWorks.tsx',
  'features/guest/marketing/for-hosts/v3/components/V3Faq.tsx',
  'features/guest/marketing/for-hosts/v3/components/V3FeatureBento.tsx',
  'features/guest/marketing/for-hosts/v3/components/V3Hero.tsx',
  'features/guest/marketing/pages/AboutPage.tsx',
  'features/guest/marketing/pages/ForHostsPage.tsx',
  'features/guest/marketing/pages/SupportPage.tsx',
  'features/guest/marketing/properties/components/PropertyCard.tsx',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const LITERAL = /'[^'\n]*'|"[^"\n]*"|`[^`]*`/g;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Class strings that put white text on the light brand fill (`bg-primary`, same variant prefix). */
export function findWhiteTextOnLightBrandFill(source: string): string[] {
  const hits: string[] = [];
  for (const literal of source.match(LITERAL) ?? []) {
    const fills = literal.matchAll(/(?<=[\s'"`])((?:[\w\-[\]=&:.]*:)?)bg-primary(?=[\s'"`])/g);
    for (const [, prefix = ''] of fills) {
      const text = new RegExp(
        `(?<=[\\s'"\`])${escape(prefix)}text-(?:primary-foreground|white)(?=[\\s'"\`/])`
      );
      if (text.test(literal)) hits.push(literal.slice(0, 120));
    }
  }
  // The sliding pill sits behind the active item's white label in a sibling element.
  for (const [pill] of source.matchAll(/<SlidingActivePill\b[^>]*?\/>/g)) {
    if (/className="[^"]*(?<=["\s])bg-primary(?=[\s"])/.test(pill)) hits.push(pill.slice(0, 120));
  }
  return hits;
}

describe('findWhiteTextOnLightBrandFill', () => {
  it('flags white text on the light fill and ignores the strong fill and accents', () => {
    expect(findWhiteTextOnLightBrandFill(`'bg-primary text-primary-foreground'`)).toHaveLength(1);
    expect(findWhiteTextOnLightBrandFill(`"rounded bg-primary text-white"`)).toHaveLength(1);
    expect(
      findWhiteTextOnLightBrandFill(
        `'data-[on=true]:bg-primary data-[on=true]:text-primary-foreground'`
      )
    ).toHaveLength(1);
    expect(findWhiteTextOnLightBrandFill(`'bg-primary-strong text-primary-foreground'`)).toEqual(
      []
    );
    expect(findWhiteTextOnLightBrandFill(`'bg-primary/10 text-primary'`)).toEqual([]);
    expect(findWhiteTextOnLightBrandFill(`'bg-primary h-2 w-2 rounded-full'`)).toEqual([]);
    expect(
      findWhiteTextOnLightBrandFill(
        `<SlidingActivePill bounds={b} className="bg-primary rounded-xl" />`
      )
    ).toHaveLength(1);
    expect(
      findWhiteTextOnLightBrandFill(
        `<SlidingActivePill bounds={b} className="bg-primary-strong" />`
      )
    ).toEqual([]);
  });
});

describe('brand fills that carry white text', () => {
  it('use bg-primary-strong (AA contrast) instead of bg-primary', () => {
    const offenders = walk(SRC)
      .map(
        (file) =>
          [relative(SRC, file), findWhiteTextOnLightBrandFill(readFileSync(file, 'utf8'))] as const
      )
      .filter(([file, hits]) => hits.length > 0 && !PENDING.has(file))
      .map(([file, hits]) => `${file}: ${hits[0]}`);
    expect(offenders).toEqual([]);
  });
});
