const OPERATOR_GUIDE_SUFFIX = /\s*[—–-]\s*operator guide\s*/gi;
const PAREN_ROUTE = /\s*\((?:`[^`]+`|[^)]*\/:[^)]+)\)\s*/g;
const BACKTICK_PATH = /`(\/[^`]+)`/g;
const BARE_ROUTE_PATH =
  /(?:^|[\s(])(\/(?:org|admin|account|properties|parkings|hosts)\/[^\s),.]*)/g;

const ROUTE_TAIL_LABELS: Record<string, string> = {
  messages: 'Messages',
  inbox: 'Guest Inbox',
  'help-support': 'Help & Support',
  bookings: 'Bookings',
  calendar: 'Calendar',
  pricing: 'Pricing',
  plans: 'Plans & Billing',
  settings: 'Settings',
  team: 'Team',
  finance: 'Finance',
  maintenance: 'Maintenance',
  marketing: 'Marketing',
  notifications: 'Notifications',
  'public-pages': 'Public Pages',
  dashboard: 'Dashboard',
  form: 'booking form',
  stays: 'Stays',
  profile: 'Profile',
};

const TITLE_ALIASES: Record<string, string> = {
  hub: 'Home',
  parkings: 'Parking listings',
  'booking detail': 'Booking details',
  'custom pages': 'Public pages',
  'public pages': 'Public pages',
  'guest web chat': 'Guest messages',
};

const MODULE_LABELS: Record<string, string> = {
  Org: 'Organization',
  Property: 'Property',
  Parking: 'Parking',
  General: 'Guest pages',
  Account: 'Guest account',
  Properties: 'Guest listings',
  Bookings: 'Guest bookings',
};

export const HELP_GUIDE_GROUPS = ['Organization', 'Property', 'Parking', 'Guest pages'] as const;

export type HelpGuideGroup = (typeof HELP_GUIDE_GROUPS)[number];

export const HELP_MODULE_ORDER = [
  'Organization',
  'Property',
  'Parking',
  'Guest pages',
  'Guest listings',
  'Guest bookings',
  'Guest account',
];

export function displayHelpGuideGroup(module: string): HelpGuideGroup {
  const label = displayHelpModule(module);
  if (label === 'Organization' || label === 'Property' || label === 'Parking') return label;
  return 'Guest pages';
}

function humanizeRoute(path: string): string {
  const parts = path.split('/').filter((part) => part && !part.startsWith(':'));
  const last = parts[parts.length - 1]?.split('?')[0] ?? '';
  return ROUTE_TAIL_LABELS[last] ?? last.replace(/-/g, ' ') ?? 'that page';
}

/** Strip internal doc jargon and URL paths from host-visible titles. */
export function sanitizeHelpTitle(raw: string): string {
  let title = raw.replace(OPERATOR_GUIDE_SUFFIX, '').replace(PAREN_ROUTE, '');
  title = title
    .replace(/`[^`]+`/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!title || title.startsWith('docs/') || title.includes('/:')) {
    return 'Guide';
  }
  return title;
}

export function displayHelpModule(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

export function displayHelpArticleTitle(raw: string): string {
  let title = sanitizeHelpTitle(raw);
  title = title.replace(/^(Org|Organization|Property|Parking)\s+/i, '');
  title = title.replace(/\s+list$/i, '').trim();
  const aliased = TITLE_ALIASES[title.toLowerCase()];
  if (aliased) return aliased;
  if (title === title.toLowerCase()) {
    return title.replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return title;
}

/** Strip route paths and operator-guide leftovers from host-visible answers. */
export function sanitizeHelpBody(raw: string): string {
  return raw
    .replace(OPERATOR_GUIDE_SUFFIX, '')
    .replace(BACKTICK_PATH, (_match, path: string) => humanizeRoute(path))
    .replace(BARE_ROUTE_PATH, (match, path: string) => {
      const prefix = match.startsWith(path) ? '' : (match[0] ?? '');
      return `${prefix}${humanizeRoute(path)}`;
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function helpModuleSortRank(module: string): number {
  const index = HELP_MODULE_ORDER.indexOf(displayHelpModule(module));
  return index === -1 ? HELP_MODULE_ORDER.length : index;
}
