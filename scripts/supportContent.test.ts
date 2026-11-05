import { describe, expect, test } from 'bun:test';

import { planSyncedFaqWrites } from './lib/faqProvenance.ts';
import {
  contentKeyFor,
  countHostFacingQa,
  defaultAudienceForPath,
  parseCuratedFaqs,
  resolveAudience,
} from './lib/supportContent.ts';

const GUIDE = `---
title: 'Some page'
audience: guest
---

## Host-facing knowledge

Intro.

**Common host questions**

- Q: First question?
  A: First answer.
- Q: Second question?
  A: Second answer.

---

## Next
`;

describe('route-guide audience', () => {
  test('defaults host, guest, and public by path', () => {
    expect(defaultAudienceForPath('docs/guides/routes/org/team.md')).toBe('host');
    expect(defaultAudienceForPath('docs/guides/routes/account/trips.md')).toBe('guest');
    expect(defaultAudienceForPath('docs/guides/routes/legal.md')).toBe('public');
    expect(defaultAudienceForPath('docs/guides/routes/admin/overview.md')).toBeNull();
  });

  test('frontmatter overrides the path default', () => {
    expect(resolveAudience(GUIDE, 'docs/guides/routes/org/team.md')).toBe('guest');
  });

  test('counts Q&A rows only in the Host-facing section', () => {
    expect(countHostFacingQa(GUIDE)).toBe(2);
    expect(countHostFacingQa('# no section')).toBe(0);
  });
});

describe('curated FAQ parsing', () => {
  test('parses metadata, body, and fallback order', () => {
    const faqs = parseCuratedFaqs(`# FAQs

### First question?

- category: Getting Started
- audience: host
- source: docs/guides/routes/org/team.md

First answer.

---

### Second question?

- category: Guest Portal
- audience: guest

Second answer
on two lines.
`);
    expect(faqs).toHaveLength(2);
    expect(faqs[0]).toMatchObject({
      category: 'Getting Started',
      audience: 'host',
      source: 'docs/guides/routes/org/team.md',
      order: 10,
      question: 'First question?',
      answer: 'First answer.',
    });
    expect(faqs[1]).toMatchObject({
      category: 'Guest Portal',
      audience: 'guest',
      source: null,
      order: 20,
      answer: 'Second answer on two lines.',
    });
    expect(faqs[0]!.contentKey).toBe(contentKeyFor('Getting Started', 'First question?'));
  });

  test('ignores blocks with no category or answer', () => {
    expect(parseCuratedFaqs('### No metadata\n\nBody without category.\n')).toEqual([]);
    expect(parseCuratedFaqs('### Empty\n\n- category: Bookings\n\n')).toEqual([]);
  });

  test('content keys are stable and ignore punctuation/case', () => {
    expect(contentKeyFor('Getting Started', "What's new?")).toBe('getting-started--whats-new');
  });
});

describe('synced FAQ provenance', () => {
  const faq = {
    contentKey: 'getting-started--whats-new',
    category: 'Getting Started',
    audience: 'host' as const,
    source: 'docs/guides/routes/org/team.md',
    order: 10,
    question: "What's new?",
    answer: 'A short answer.',
  };

  test('inserts a new synced FAQ as published', () => {
    const plan = planSyncedFaqWrites([faq], []);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({ origin: 'synced', is_published: true });
    expect(plan.updates).toHaveLength(0);
    expect(plan.pruneIds).toEqual([]);
  });

  test('preserves an unpublish on update', () => {
    const plan = planSyncedFaqWrites(
      [faq],
      [
        {
          id: 'row-1',
          content_key: faq.contentKey,
          category: faq.category,
          question: faq.question,
          is_published: false,
        },
      ]
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]).toMatchObject({ id: 'row-1', values: { is_published: false } });
  });

  test('adopts a legacy synced row by category and question', () => {
    const plan = planSyncedFaqWrites(
      [faq],
      [
        {
          id: 'legacy',
          content_key: null,
          category: faq.category,
          question: faq.question,
          is_published: true,
        },
      ]
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]!.id).toBe('legacy');
    expect(plan.inserts).toHaveLength(0);
    expect(plan.pruneIds).toEqual([]);
  });

  test('prunes synced rows whose key disappeared', () => {
    const plan = planSyncedFaqWrites(
      [faq],
      [
        {
          id: 'removed',
          content_key: 'old-key',
          category: 'Bookings',
          question: 'Old?',
          is_published: true,
        },
      ]
    );
    expect(plan.pruneIds).toEqual(['removed']);
  });
});
