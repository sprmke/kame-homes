/**
 * UI mirror of `_shared/contractLifecycle.ts` (Unit handoff Phase B).
 * Keep predicates aligned with the edge module.
 */

export const CONSIDERATION_MAX_DAYS = 14;
export const GRACE_DAYS_INCLUSIVE = 4;
export const LOCK_DAY_OFFSET = 5;

export type ContractLeg = 'property' | 'parking';

export const CONTRACT_NOTICE_MILESTONES = [
  't_minus_15',
  't_minus_7',
  't_minus_1',
  't_plus_0_archived',
  't_plus_3',
  't_plus_5_locked',
  'grant_expired',
] as const;
export type ContractNoticeMilestone = (typeof CONTRACT_NOTICE_MILESTONES)[number];

export const CONSIDERATION_STATUSES = ['none', 'pending', 'changes', 'granted', 'denied'] as const;
export type ConsiderationStatus = (typeof CONSIDERATION_STATUSES)[number];

export type ContractConsiderationAuditEntry = {
  at: string;
  by: string | null;
  action: string;
  note: string | null;
};

export type ContractConsideration = {
  status: ConsiderationStatus;
  note: string | null;
  expectedDate: string | null;
  grantedUntil: string | null;
  proofPaths: string[];
  audit: ContractConsiderationAuditEntry[];
  selfServeUsedThisCycle: boolean;
  allowConsiderationOverride: boolean;
};

export type ContractLegLifecycle = {
  noticesSent: Partial<Record<ContractNoticeMilestone, string>>;
  accessLockedAt: string | null;
  consideration: ContractConsideration;
};

export function emptyContractConsideration(): ContractConsideration {
  return {
    status: 'none',
    note: null,
    expectedDate: null,
    grantedUntil: null,
    proofPaths: [],
    audit: [],
    selfServeUsedThisCycle: false,
    allowConsiderationOverride: false,
  };
}

export function emptyContractLegLifecycle(): ContractLegLifecycle {
  return {
    noticesSent: {},
    accessLockedAt: null,
    consideration: emptyContractConsideration(),
  };
}

function daysBetweenYmd(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T12:00:00.000Z`).getTime();
  const b = new Date(`${to.slice(0, 10)}T12:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function daysUntilContractEnd(contractEndYmd: string, todayYmd: string): number {
  return daysBetweenYmd(todayYmd, contractEndYmd);
}

export function daysSinceContractEnd(contractEndYmd: string, todayYmd: string): number | null {
  const until = daysUntilContractEnd(contractEndYmd, todayYmd);
  if (until > 0) return null;
  return -until;
}

export function isInGracePeriod(contractEndYmd: string, todayYmd: string): boolean {
  const since = daysSinceContractEnd(contractEndYmd, todayYmd);
  return since != null && since >= 0 && since <= GRACE_DAYS_INCLUSIVE;
}

/** Days until access lock (T+5) while in grace (T+0…T+4). */
export function daysUntilContractAccessLock(
  contractEndYmd: string,
  todayYmd: string
): number | null {
  if (!isInGracePeriod(contractEndYmd, todayYmd)) return null;
  const since = daysSinceContractEnd(contractEndYmd, todayYmd);
  if (since == null) return null;
  return LOCK_DAY_OFFSET - since;
}

export function hasActiveConsiderationGrant(
  lifecycle: ContractLegLifecycle,
  todayYmd: string
): boolean {
  const { status, grantedUntil } = lifecycle.consideration;
  if (status !== 'granted' || !grantedUntil) return false;
  return grantedUntil >= todayYmd;
}

export function isListingAccessLocked(lifecycle: ContractLegLifecycle): boolean {
  return Boolean(lifecycle.accessLockedAt);
}

function asYmd(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function asIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asStatus(value: unknown): ConsiderationStatus {
  if (typeof value === 'string' && (CONSIDERATION_STATUSES as readonly string[]).includes(value)) {
    return value as ConsiderationStatus;
  }
  return 'none';
}

export function parseContractLegLifecycle(raw: unknown): ContractLegLifecycle {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyContractLegLifecycle();
  }
  const v = raw as Record<string, unknown>;
  const noticesRaw =
    v.noticesSent && typeof v.noticesSent === 'object' && !Array.isArray(v.noticesSent)
      ? (v.noticesSent as Record<string, unknown>)
      : {};
  const noticesSent: Partial<Record<ContractNoticeMilestone, string>> = {};
  for (const key of CONTRACT_NOTICE_MILESTONES) {
    const sentAt = asIso(noticesRaw[key]);
    if (sentAt) noticesSent[key] = sentAt;
  }

  const cRaw = v.consideration;
  const c =
    cRaw && typeof cRaw === 'object' && !Array.isArray(cRaw)
      ? (cRaw as Record<string, unknown>)
      : {};
  const proofRaw = c.proofPaths;
  const proofPaths = Array.isArray(proofRaw)
    ? proofRaw
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map((p) => p.trim())
    : [];

  return {
    noticesSent,
    accessLockedAt: asIso(v.accessLockedAt),
    consideration: {
      status: asStatus(c.status),
      note: typeof c.note === 'string' && c.note.trim() ? c.note.trim() : null,
      expectedDate: asYmd(c.expectedDate),
      grantedUntil: asYmd(c.grantedUntil),
      proofPaths,
      audit: [],
      selfServeUsedThisCycle: c.selfServeUsedThisCycle === true,
      allowConsiderationOverride: c.allowConsiderationOverride === true,
    },
  };
}

/** Pre-expiry in-app reminder window (days before end, inclusive). Aligns with t_minus_15 email. */
export const PRE_EXPIRY_REMINDER_MAX_DAYS = 15;

export function isInPreExpiryWindow(
  contractEndYmd: string,
  todayYmd: string,
  maxDaysBefore: number = PRE_EXPIRY_REMINDER_MAX_DAYS
): boolean {
  const until = daysUntilContractEnd(contractEndYmd, todayYmd);
  return until >= 1 && until <= maxDaysBefore;
}

export type ListingContractRenewalPhase = 'none' | 'pre_expiry' | 'grace' | 'locked' | 'granted';

/** Listing had (or has) a contract-end lifecycle — includes residual state after rights changes. */
export function listingHasContractRenewalLifecycle(
  contractEndYmd: string | null,
  lifecycle: ContractLegLifecycle
): boolean {
  if (contractEndYmd) return true;
  if (lifecycle.accessLockedAt) return true;
  if (Object.keys(lifecycle.noticesSent).length > 0) return true;
  if (lifecycle.consideration.status !== 'none') return true;
  return false;
}

export function resolveListingContractRenewalPhase(
  contractEndYmd: string | null,
  lifecycle: ContractLegLifecycle,
  todayYmd: string
): ListingContractRenewalPhase {
  if (hasActiveConsiderationGrant(lifecycle, todayYmd)) return 'granted';
  if (isListingAccessLocked(lifecycle)) return 'locked';

  const { status, grantedUntil } = lifecycle.consideration;
  if (status === 'granted' && grantedUntil && grantedUntil < todayYmd) {
    return 'locked';
  }

  if (contractEndYmd) {
    if (isInGracePeriod(contractEndYmd, todayYmd)) return 'grace';
    if (isInPreExpiryWindow(contractEndYmd, todayYmd)) return 'pre_expiry';
    const since = daysSinceContractEnd(contractEndYmd, todayYmd);
    if (since != null && since >= LOCK_DAY_OFFSET) return 'locked';
  }

  return 'none';
}

export function readContractLegLifecycleFromVerification(
  verification: Record<string, unknown> | null | undefined,
  leg: ContractLeg
): ContractLegLifecycle {
  if (!verification) return emptyContractLegLifecycle();
  const key = leg === 'parking' ? 'parkingLifecycle' : 'propertyLifecycle';
  return parseContractLegLifecycle(verification[key]);
}
