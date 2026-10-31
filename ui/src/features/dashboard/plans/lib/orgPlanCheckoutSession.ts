const STORAGE_KEY = 'gfm:org-plan-checkout';

export type OrgPlanCheckoutSession = {
  orgId: string;
  transactionId: string;
  startedAt: number;
  previousPlanId: string | null;
  targetPlanId: string;
};

const CELEBRATION_KEY = 'gfm:org-plan-upgrade-celebration';

export type OrgPlanUpgradeCelebration = {
  orgId: string;
  previousPlanId: string | null;
  targetPlanId: string;
  fulfilledAt: number;
};

function readAll(): OrgPlanCheckoutSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrgPlanCheckoutSession;
    if (
      typeof parsed.orgId !== 'string' ||
      typeof parsed.transactionId !== 'string' ||
      typeof parsed.startedAt !== 'number' ||
      typeof parsed.targetPlanId !== 'string' ||
      (parsed.previousPlanId !== null && typeof parsed.previousPlanId !== 'string')
    ) {
      return null;
    }
    return {
      orgId: parsed.orgId,
      transactionId: parsed.transactionId,
      startedAt: parsed.startedAt,
      previousPlanId: parsed.previousPlanId ?? null,
      targetPlanId: parsed.targetPlanId,
    };
  } catch {
    return null;
  }
}

export function markOrgPlanCheckoutSession(session: OrgPlanCheckoutSession): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function readOrgPlanCheckoutSession(orgId: string): OrgPlanCheckoutSession | null {
  const session = readAll();
  if (!session || session.orgId !== orgId) return null;
  return session;
}

export function clearOrgPlanCheckoutSession(orgId: string): void {
  if (typeof window === 'undefined') return;
  const session = readAll();
  if (session?.orgId === orgId) {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

/** Stop polling after 15 minutes — webhook should have landed by then. */
export const ORG_PLAN_CHECKOUT_WATCH_MS = 15 * 60 * 1000;

export function isOrgPlanCheckoutWatchExpired(session: OrgPlanCheckoutSession): boolean {
  return Date.now() - session.startedAt > ORG_PLAN_CHECKOUT_WATCH_MS;
}

export function writeOrgPlanUpgradeCelebration(payload: OrgPlanUpgradeCelebration): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CELEBRATION_KEY, JSON.stringify(payload));
}

export function consumeOrgPlanUpgradeCelebration(orgId: string): OrgPlanUpgradeCelebration | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CELEBRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrgPlanUpgradeCelebration;
    if (parsed.orgId !== orgId || typeof parsed.targetPlanId !== 'string') return null;
    sessionStorage.removeItem(CELEBRATION_KEY);
    return parsed;
  } catch {
    return null;
  }
}
