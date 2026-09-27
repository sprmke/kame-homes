/**
 * Literal, host-visible expectations for the plan cards and the Compare table.
 *
 * Deliberately NOT derived from app code: this is the independent oracle. The unit test
 * (planTierExpectations.test.ts) proves the app renders exactly this, and the Playwright
 * specs (ui/e2e/features/plans) prove the pages show exactly this. Pure data, no imports,
 * so both runners can load it.
 *
 * Changing a tier, a bullet or a row label on purpose? Update this file in the same change.
 */

/** `on` = check, `off` = dash, anything else is the text the cell shows. */
export type CompareCell = string;

export type CompareRowExpectation = {
  label: string;
  /** Free, Starter, Pro, Business, Managed. `on` = check, `off` = dash, anything else = the text shown. */
  cells: [CompareCell, CompareCell, CompareCell, CompareCell, CompareCell];
};

export type CompareGroupExpectation = { label: string; rows: CompareRowExpectation[] };

export const TIER_ORDER = ['free', 'starter', 'growth', 'pro', 'managed'] as const;
export type TierCode = (typeof TIER_ORDER)[number];

export const TIER_TITLES: Record<TierCode, string> = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Pro',
  pro: 'Business',
  managed: 'Managed',
};

export const COMPARE_EXPECTATIONS: CompareGroupExpectation[] = [
  {
    label: 'Dashboard',
    rows: [
      { label: 'Dashboard overview', cells: ['on', 'on', 'on', 'on', 'on'] },
      { label: 'Copy property settings', cells: ['off', 'off', 'on', 'on', 'on'] },
    ],
  },
  {
    label: 'Bookings',
    rows: [
      { label: 'Manual booking management', cells: ['on', 'on', 'on', 'on', 'on'] },
      { label: 'Public guest form', cells: ['on', 'on', 'on', 'on', 'on'] },
      { label: 'Manual document generation', cells: ['on', 'on', 'on', 'on', 'on'] },
      { label: 'Automated booking emails', cells: ['off', 'on', 'on', 'on', 'on'] },
      { label: 'AI booking import', cells: ['off', 'on', 'on', 'on', 'on'] },
      { label: 'AI receipt and ID validation', cells: ['off', 'off', 'on', 'on', 'on'] },
    ],
  },
  {
    label: 'Finance',
    rows: [
      { label: 'Finance management', cells: ['on', 'on', 'on', 'on', 'on'] },
      { label: 'Finance reporting & export', cells: ['off', 'on', 'on', 'on', 'on'] },
    ],
  },
  {
    label: 'Maintenance',
    rows: [
      { label: 'Maintenance reminders', cells: ['on', 'on', 'on', 'on', 'on'] },
      { label: 'Maintenance reporting & export', cells: ['off', 'on', 'on', 'on', 'on'] },
    ],
  },
  {
    label: 'Pricing',
    rows: [
      { label: 'Pricing management', cells: ['off', 'on', 'on', 'on', 'on'] },
      { label: 'Airbnb calendar sync', cells: ['off', 'off', 'on', 'on', 'on'] },
      { label: 'Smart AI Pricing', cells: ['off', 'off', 'on', 'on', 'on'] },
    ],
  },
  {
    label: 'Analytics',
    rows: [{ label: 'Analytics export and AI review', cells: ['off', 'off', 'on', 'on', 'on'] }],
  },
  {
    label: 'Team',
    rows: [
      { label: 'Team members', cells: ['Up to 1', 'Up to 3', 'Up to 5', 'Up to 10', 'Unlimited'] },
      { label: 'Custom team roles', cells: ['off', 'on', 'on', 'on', 'on'] },
    ],
  },
  {
    label: 'Marketing',
    rows: [
      { label: 'Content Studio', cells: ['off', 'off', 'on', 'on', 'on'] },
      { label: 'AI content generation', cells: ['off', 'off', 'off', 'on', 'on'] },
      { label: 'AI image generation', cells: ['off', 'off', 'on', 'on', 'on'] },
      { label: 'AI video generation', cells: ['off', 'off', 'off', 'on', 'on'] },
      {
        label: 'Publish in Meta platforms',
        cells: ['off', 'off', 'off', 'Unlimited', 'Unlimited'],
      },
    ],
  },
  {
    label: 'Inbox',
    rows: [
      { label: 'Inbox quick replies', cells: ['off', 'on', 'on', 'on', 'on'] },
      { label: 'Meta (Facebook/Instagram) chat channel', cells: ['off', 'off', 'off', 'on', 'on'] },
      { label: 'AI chat auto-reply', cells: ['off', 'off', 'off', 'on', 'on'] },
    ],
  },
  {
    label: 'Notifications',
    rows: [
      { label: 'In-app notifications', cells: ['on', 'on', 'on', 'on', 'on'] },
      { label: 'Telegram alerts', cells: ['off', 'on', 'on', 'on', 'on'] },
    ],
  },
  {
    label: 'Templates',
    rows: [{ label: 'Advanced template management', cells: ['off', 'on', 'on', 'on', 'on'] }],
  },
  {
    label: 'Public pages',
    rows: [
      { label: 'Public pages editor', cells: ['off', 'off', 'on', 'on', 'on'] },
      { label: 'Property showcase & stay guide access', cells: ['off', 'off', 'on', 'on', 'on'] },
    ],
  },
  {
    label: 'Visibility',
    rows: [
      { label: 'Verified badge eligible', cells: ['off', 'on', 'on', 'on', 'on'] },
      { label: 'Recommended badge eligible', cells: ['off', 'off', 'on', 'on', 'on'] },
      { label: 'Search placement', cells: ['off', 'off', 'Top 30', 'Top 15', 'Top 15'] },
    ],
  },
  {
    label: 'AI',
    rows: [
      { label: 'AI dashboard assistant', cells: ['off', 'off', 'off', 'on', 'on'] },
      { label: 'AI receptionist', cells: ['off', 'off', 'off', 'on', 'on'] },
      { label: 'AI credits', cells: ['off', 'off', '5,000 / mo', '25,000 / mo', '60,000 / mo'] },
    ],
  },
  {
    label: 'Managed hosting',
    rows: [
      {
        label:
          "We'll manage everything, from bookings to operations, marketing, chat, reminders, etc",
        cells: ['off', 'off', 'off', 'off', 'on'],
      },
      { label: 'Ideal for hosts with limited time', cells: ['off', 'off', 'off', 'off', 'on'] },
      {
        label: 'Full transparency on bookings and finance',
        cells: ['off', 'off', 'off', 'off', 'on'],
      },
      {
        label: 'Earn from your listing with minimal work & supervision',
        cells: ['off', 'off', 'off', 'off', 'on'],
      },
      {
        label: 'Free social media boosts across listing groups',
        cells: ['off', 'off', 'off', 'off', 'on'],
      },
      {
        label: 'Cleaning and maintenance staff available (separate fee)',
        cells: ['off', 'off', 'off', 'off', 'on'],
      },
    ],
  },
];

export type CardExpectation = {
  title: string;
  /** Price shown big on the card. */
  price: string;
  /** Struck-through list price, when a promo applies. */
  compareAt: string | null;
  badge: string | null;
  /** "Everything in X, plus" anchor. */
  inherits: string | null;
  pitch: string;
  bullets: string[];
};

export const CARD_EXPECTATIONS: Record<TierCode, CardExpectation> = {
  free: {
    title: 'Free',
    price: '₱0',
    compareAt: null,
    badge: null,
    inherits: null,
    pitch: 'Essential tools to manage your properties at no cost.',
    bullets: [
      'Dashboard overview',
      'Manual booking management',
      'Public guest form',
      'Manual document generation',
      'Standard template management',
      'Finance management',
      'Maintenance reminders',
      'Notifications',
    ],
  },
  starter: {
    title: 'Starter',
    price: '₱399',
    compareAt: '₱499',
    badge: 'Best value',
    inherits: 'Free',
    pitch: 'Automate everyday operations and manage your team with ease.',
    bullets: [
      'Pricing management',
      'Automated booking emails',
      'Verified badge eligible',
      'Up to 3 team members',
      'Custom team roles',
      'Advanced template management',
      'Telegram alerts',
      'Finance reporting & export',
      'Maintenance reporting & export',
      'Inbox quick replies',
      'AI booking import',
    ],
  },
  growth: {
    title: 'Pro',
    price: '₱799',
    compareAt: '₱999',
    badge: 'Most popular',
    inherits: 'Starter',
    pitch: 'Reach more guests with greater publishing and search visibility.',
    bullets: [
      'Up to 5 team members',
      'Marketing Content Studio',
      'Top 30 search placement',
      'AI receipt and ID validation',
      'Recommended badge eligible',
      'Public pages editor',
      'Property showcase & stay guide access',
      'Airbnb calendar sync',
      'Smart AI Pricing',
      'Copy property settings',
      'Analytics export and AI review',
      'AI image generation',
      '5,000 AI credits per month',
    ],
  },
  pro: {
    title: 'Business',
    price: '₱1,439',
    compareAt: '₱1,799',
    badge: 'Recommended',
    inherits: 'Pro',
    pitch: 'Simplify your management with AI-powered features.',
    bullets: [
      'Up to 10 team members',
      'Publish in Meta platforms',
      'Top 15 search placement',
      'AI content generation',
      'AI dashboard assistant',
      'AI receptionist',
      'AI chat auto-reply',
      'Meta (Facebook/Instagram) chat channel',
      'AI video generation',
      '25,000 AI credits per month',
    ],
  },
  managed: {
    title: 'Managed',
    price: '₱3,999',
    compareAt: '₱4,999',
    badge: 'Hands-off hosting',
    inherits: 'Business',
    pitch: 'Let us handle your operations while you focus on growing your business.',
    bullets: [
      '60,000 AI credits per month',
      "We'll manage everything, from bookings to operations, marketing, chat, reminders, etc",
      'Ideal for hosts with limited time',
      'Full transparency on bookings and finance',
      'Earn from your listing with minimal work & supervision',
      'Free social media boosts from our marketing team to help promote your listings across different groups',
      'Cleaning and maintenance staff available (separate fee)',
    ],
  },
};

/**
 * Card bullet -> Compare row label, where the two surfaces word the same capability differently
 * (or the card lists something Compare has no row for). `null` means Compare has no row.
 * Any card bullet not in this map must appear verbatim as a Compare row label, or as
 * "Up to N team members" / "Top N search placement" / "N AI credits per month" (numeric bullets).
 */
export const CARD_BULLET_COMPARE_LABEL: Record<string, string | null> = {
  'Standard template management': null,
  Notifications: 'In-app notifications',
  'Marketing Content Studio': 'Content Studio',
  "We'll manage everything, from bookings to operations, marketing, chat, reminders, etc":
    "We'll manage everything, from bookings to operations, marketing, chat, reminders, etc",
  'Free social media boosts from our marketing team to help promote your listings across different groups':
    'Free social media boosts across listing groups',
  'Smart AI Pricing': 'Smart AI Pricing',
  'Publish in Meta platforms': 'Publish in Meta platforms',
};

/** Compare-table label + the cell text/state a card bullet must correspond to for tier `index`. */
export function compareTargetForBullet(
  bullet: string,
  index: number
): { rowLabel: string; expected: (cell: string) => boolean } | null {
  const mapped = CARD_BULLET_COMPARE_LABEL[bullet];
  if (mapped === null) return null;
  const isOn = (cell: string) => cell === 'on';
  if (/^Up to \d+ team members$/.test(bullet)) {
    return { rowLabel: 'Team members', expected: (cell) => cell === bullet.match(/Up to \d+/)![0] };
  }
  if (/^Top \d+ search placement$/.test(bullet)) {
    return {
      rowLabel: 'Search placement',
      expected: (cell) => cell === bullet.match(/Top \d+/)![0],
    };
  }
  if (/^[\d,]+ AI credits per month$/.test(bullet)) {
    return {
      rowLabel: 'AI credits',
      expected: (cell) => cell === `${bullet.match(/^[\d,]+/)![0]} / mo`,
    };
  }
  if (bullet === 'Publish in Meta platforms') {
    return { rowLabel: bullet, expected: (cell) => cell !== 'off' };
  }
  void index;
  return { rowLabel: mapped ?? bullet, expected: isOn };
}

/**
 * What the plan review dialog lists under "Unlocks" when moving up one tier, keyed
 * `from>to` by plan code (`growth` is Pro, `pro` is Business). Reviewed against the
 * Compare matrix; the unit test pins these to `planFeatureGains`.
 */
export const UNLOCKS: Record<string, string[]> = {
  'free>starter': [
    'Automated booking emails',
    'AI booking import',
    'Finance reporting & export',
    'Maintenance reporting & export',
    'Up to 3 team members',
    'Custom team roles',
    'Inbox quick replies',
    'Telegram alerts',
    'Advanced template management',
    'Verified badge eligible',
  ],
  'starter>growth': [
    'AI receipt and ID validation',
    'Copy property settings',
    'Airbnb calendar sync',
    'Smart AI Pricing',
    'Analytics export and AI review',
    'Up to 5 team members',
    'Content Studio',
    'AI image generation',
    'Public pages editor',
    'Property showcase & stay guide access',
    'Recommended badge eligible',
    'Top 30 search placement',
    '5,000 AI credits per month',
  ],
  'growth>pro': [
    'Up to 10 team members',
    'AI content generation',
    'AI video generation',
    'Unlimited Meta publishing',
    'Meta (Facebook/Instagram) chat channel',
    'AI chat auto-reply',
    'Top 15 search placement',
    'AI dashboard assistant',
    'AI receptionist',
    '25,000 AI credits per month',
  ],
  'pro>managed': [
    'Unlimited team members',
    '60,000 AI credits per month',
    "We'll manage everything, from bookings to operations, marketing, chat, reminders, etc",
  ],
};

/** "Removes" list when moving down; the one-step downgrades mirror the upgrades above. */
export const REMOVES: Record<string, string[]> = {
  'starter>free': UNLOCKS['free>starter'],
  'growth>starter': UNLOCKS['starter>growth'],
  'pro>growth': UNLOCKS['growth>pro'],
  'managed>pro': UNLOCKS['pro>managed'],
  'pro>free': [
    'Automated booking emails',
    'AI booking import',
    'AI receipt and ID validation',
    'Copy property settings',
    'Finance reporting & export',
    'Maintenance reporting & export',
    'Airbnb calendar sync',
    'Smart AI Pricing',
    'Analytics export and AI review',
    'Up to 10 team members',
    'Custom team roles',
    'Content Studio',
    'AI content generation',
    'AI image generation',
    'AI video generation',
    'Unlimited Meta publishing',
    'Inbox quick replies',
    'Meta (Facebook/Instagram) chat channel',
    'AI chat auto-reply',
    'Telegram alerts',
    'Advanced template management',
    'Public pages editor',
    'Property showcase & stay guide access',
    'Verified badge eligible',
    'Recommended badge eligible',
    'Top 15 search placement',
    'AI dashboard assistant',
    'AI receptionist',
    '25,000 AI credits per month',
  ],
};

/** Org total shown in the review dialog for the mock org's single enrolled property. */
export const ONE_PROPERTY_MONTHLY_TOTAL: Record<TierCode, string> = {
  free: '₱0',
  starter: '₱399',
  growth: '₱799',
  pro: '₱1,439',
  managed: '₱3,999',
};
