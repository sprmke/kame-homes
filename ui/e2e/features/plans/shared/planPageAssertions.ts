/**
 * Assertions for the plan cards and the Compare table, shared by the public pricing page and
 * the in-app Plans page. Expectations come from `planTierExpectations.ts` (literal, host-visible
 * text), which a unit test pins to the app code, so a failure here means the page and the
 * documented tiers disagree.
 */

import { expect, type Locator, type Page } from '@playwright/test';

import {
  CARD_EXPECTATIONS,
  COMPARE_EXPECTATIONS,
  TIER_ORDER,
  TIER_TITLES,
  type CompareGroupExpectation,
  type TierCode,
} from '../../../../src/features/dashboard/plans/lib/planTierExpectations';

const squash = (value: string) => value.replace(/\s+/g, '');

export function tierCard(page: Page, code: TierCode): Locator {
  return page.locator(`article[aria-labelledby="plan-tier-${code}"]`);
}

export function compareTable(page: Page): Locator {
  return page
    .locator('table')
    .filter({ has: page.locator('th[scope="col"]') })
    .first();
}

/** Every tier card carries the documented title, price, promo, anchor, pitch and bullets. */
export async function expectTierCards(page: Page): Promise<void> {
  await expect(page.locator('article[aria-labelledby^="plan-tier-"]')).toHaveCount(
    TIER_ORDER.length
  );

  for (const code of TIER_ORDER) {
    const expected = CARD_EXPECTATIONS[code];
    const card = tierCard(page, code);
    await expect(card, `${code} card`).toHaveCount(1);
    await expect(card.getByRole('heading', { level: 3 })).toHaveText(expected.title);

    const text = squash(await card.innerText());
    expect(text, `${code} price`).toContain(squash(expected.price));
    if (expected.compareAt) {
      expect(text, `${code} list price`).toContain(squash(expected.compareAt));
      expect(text, `${code} discount pill`).toContain('20%off');
    } else {
      expect(text, `${code} has no strikethrough price`).not.toContain('%off');
    }
    expect(text, `${code} pitch`).toContain(squash(expected.pitch));

    if (expected.inherits) {
      expect(text, `${code} anchor`).toContain(squash(`Everything in ${expected.inherits}, plus`));
    } else {
      expect(text, `${code} has no anchor`).not.toContain('Everythingin');
    }

    // Badges sit in the card header, before the pitch. Bullets can contain the same words.
    const header = text.slice(0, text.indexOf(squash(expected.pitch)));
    const allBadges = Object.values(CARD_EXPECTATIONS)
      .map((card) => card.badge)
      .filter((badge): badge is string => Boolean(badge));
    for (const badge of allBadges) {
      if (badge === expected.badge) expect(header, `${code} badge`).toContain(squash(badge));
      else expect(header, `${code} must not show "${badge}"`).not.toContain(squash(badge));
    }

    await expect(card.locator('ul > li'), `${code} bullets`).toHaveText(expected.bullets);
  }
}

type RenderedTable = {
  headers: string[];
  currentHeader: string | null;
  groups: Array<{ label: string; rows: Array<{ label: string; cells: string[] }> }>;
  actions: string[];
};

/** Reads the Compare table into plain data so a failure prints one readable diff. */
export async function readCompareTable(page: Page): Promise<RenderedTable> {
  return compareTable(page).evaluate((table) => {
    const text = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const headers = Array.from(table.querySelectorAll('thead th[scope="col"]')).map(text);
    const current = table.querySelector('thead th[aria-current="true"]');
    const groups = Array.from(table.querySelectorAll('tbody')).map((body) => {
      const [head, ...rows] = Array.from(body.querySelectorAll('tr'));
      return {
        label: text(head.querySelector('th')),
        rows: rows.map((row) => ({
          label: text(row.querySelector('th')),
          cells: Array.from(row.querySelectorAll('td')).map((cell) => {
            const value = text(cell);
            if (value === 'Included') return 'on';
            if (value === 'Not included') return 'off';
            return value;
          }),
        })),
      };
    });
    const actions = Array.from(table.querySelectorAll('tfoot button')).map(
      (button) => button.getAttribute('aria-label') ?? text(button)
    );
    return { headers, currentHeader: current ? text(current) : null, groups, actions };
  });
}

/** The Compare table matches the documented rows, order, and per-tier values. */
export async function expectCompareTable(
  page: Page,
  options: { currentTier?: TierCode | null; hasActions?: boolean } = {}
): Promise<void> {
  await expect(compareTable(page)).toBeVisible();
  const rendered = await readCompareTable(page);

  expect(rendered.headers[0]).toBe('Feature');
  TIER_ORDER.forEach((code, index) => {
    expect(rendered.headers[index + 1], `${code} column header`).toContain(TIER_TITLES[code]);
  });

  const expected: CompareGroupExpectation[] = COMPARE_EXPECTATIONS;
  expect(rendered.groups.map((g) => g.label)).toEqual(expected.map((g) => g.label));
  expect(rendered.groups).toEqual(
    expected.map((group) => ({
      label: group.label,
      rows: group.rows.map((row) => ({ label: row.label, cells: [...row.cells] })),
    }))
  );

  if (options.currentTier) {
    expect(rendered.currentHeader, 'current plan column').toContain(
      TIER_TITLES[options.currentTier]
    );
  } else {
    expect(rendered.currentHeader).toBeNull();
  }
  if (options.hasActions !== false) {
    expect(rendered.actions).toHaveLength(TIER_ORDER.length);
  }
}

/**
 * The tier rail is a carousel (3 cards at desktop width). Page to the end that holds the card
 * using the arrow's own disabled state, so the card is on screen and its button clickable.
 */
export async function bringTierCardIntoView(page: Page, code: TierCode): Promise<Locator> {
  const card = tierCard(page, code);
  const goToStart = TIER_ORDER.indexOf(code) <= 2;
  const arrow = page.getByRole('button', { name: goToStart ? 'Previous plans' : 'Next plans' });
  for (let step = 0; step < 6; step += 1) {
    if ((await arrow.count()) === 0 || !(await arrow.isEnabled())) break;
    await arrow.click();
    // The track slides for ~300ms; wait for it to settle before reading state.
    await page.waitForTimeout(450);
  }
  // Polls, so the initial slide-to-current animation on first paint cannot race this.
  await expect(card).toBeInViewport({ timeout: 10_000 });
  return card;
}

/**
 * Run an idempotent "open the page and wait for it" step, retrying through the Vite dev
 * server's cold-start behaviour: when it discovers new dependencies it reloads the page
 * mid-test, which resets whatever the test was doing. Only wrap steps that start from a
 * fresh navigation.
 */
export async function retryThroughDevReload(step: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await step();
  }).toPass({ timeout: 60_000, intervals: [250, 500, 1_000, 2_000] });
}
