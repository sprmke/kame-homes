/**
 * Sublessee / Auth Rep contract-expiry lifecycle (Unit handoff Phase B).
 * Stored per leg under organizations.settings.verification.{property|parking}Lifecycle.
 */

import { daysBetweenIso, addDaysToIso } from './financeRecurrence.ts';
import { manilaTodayYmd } from './calendarAvailabilityManila.ts';

/** Mirrors orgVerification.verificationRightsNeedsContractEnd — keep in sync. */
export function rightsNeedContractLifecycle(rights: string | null | undefined): boolean {
  return rights === 'authorized_representative' || rights === 'sublessee';
}

export const CONSIDERATION_MAX_DAYS = 14;

/** Pre-expiry notice offsets (days before contract end, Manila). */
export const NOTICE_DAYS_BEFORE = [15, 7, 1] as const;

/** Grace window after end date (inclusive): T+0 … T+4. */
export const GRACE_DAYS_INCLUSIVE = 4;

/** Listing lock starts at T+5 (days after end). */
export const LOCK_DAY_OFFSET = 5;

/** Mid-grace reminder day (T+3). */
export const GRACE_REMINDER_DAY = 3;

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

function asYmd(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function asIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asConsiderationStatus(value: unknown): ConsiderationStatus {
  if (typeof value === 'string' && (CONSIDERATION_STATUSES as readonly string[]).includes(value)) {
    return value as ConsiderationStatus;
  }
  return 'none';
}

function asAuditEntry(value: unknown): ContractConsiderationAuditEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const at = asIso(row.at);
  const action = typeof row.action === 'string' ? row.action.trim() : '';
  if (!at || !action) return null;
  return {
    at,
    by: typeof row.by === 'string' && row.by.trim() ? row.by.trim() : null,
    action,
    note: typeof row.note === 'string' && row.note.trim() ? row.note.trim() : null,
  };
}

export function parseContractConsideration(raw: unknown): ContractConsideration {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyContractConsideration();
  }
  const c = raw as Record<string, unknown>;
  const proofRaw = c.proofPaths;
  const proofPaths = Array.isArray(proofRaw)
    ? proofRaw
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map((p) => p.trim())
    : [];
  const auditRaw = c.audit;
  const audit = Array.isArray(auditRaw)
    ? auditRaw.map(asAuditEntry).filter((e): e is ContractConsiderationAuditEntry => e != null)
    : [];

  return {
    status: asConsiderationStatus(c.status),
    note: typeof c.note === 'string' && c.note.trim() ? c.note.trim() : null,
    expectedDate: asYmd(c.expectedDate),
    grantedUntil: asYmd(c.grantedUntil),
    proofPaths,
    audit,
    selfServeUsedThisCycle: c.selfServeUsedThisCycle === true,
    allowConsiderationOverride: c.allowConsiderationOverride === true,
  };
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

  return {
    noticesSent,
    accessLockedAt: asIso(v.accessLockedAt),
    consideration: parseContractConsideration(v.consideration),
  };
}

export function contractLegLifecycleToSettingsValue(
  state: ContractLegLifecycle
): Record<string, unknown> {
  return {
    noticesSent: { ...state.noticesSent },
    accessLockedAt: state.accessLockedAt,
    consideration: {
      status: state.consideration.status,
      note: state.consideration.note,
      expectedDate: state.consideration.expectedDate,
      grantedUntil: state.consideration.grantedUntil,
      proofPaths: [...state.consideration.proofPaths],
      audit: state.consideration.audit.map((e) => ({ ...e })),
      selfServeUsedThisCycle: state.consideration.selfServeUsedThisCycle,
      allowConsiderationOverride: state.consideration.allowConsiderationOverride,
    },
  };
}

/** Days until contract end (positive before, 0 on end day, negative after). */
export function daysUntilContractEnd(
  contractEndYmd: string,
  todayYmd: string = manilaTodayYmd()
): number {
  return daysBetweenIso(todayYmd, contractEndYmd.slice(0, 10));
}

/** Days since contract end (0 on end day, positive after). Null if before end. */
export function daysSinceContractEnd(
  contractEndYmd: string,
  todayYmd: string = manilaTodayYmd()
): number | null {
  const until = daysUntilContractEnd(contractEndYmd, todayYmd);
  if (until > 0) return null;
  return -until;
}

export function addManilaDays(ymd: string, days: number): string {
  return addDaysToIso(ymd.slice(0, 10), days);
}

export function isContractLifecycleApplicable(rights: string | null | undefined): boolean {
  return rightsNeedContractLifecycle(rights);
}

export function noticeMilestoneForDaysBefore(
  daysBefore: number
): Extract<ContractNoticeMilestone, 't_minus_15' | 't_minus_7' | 't_minus_1'> | null {
  if (daysBefore === 15) return 't_minus_15';
  if (daysBefore === 7) return 't_minus_7';
  if (daysBefore === 1) return 't_minus_1';
  return null;
}

export function shouldSendPreExpiryNotice(
  contractEndYmd: string,
  milestone: Extract<ContractNoticeMilestone, 't_minus_15' | 't_minus_7' | 't_minus_1'>,
  noticesSent: ContractLegLifecycle['noticesSent'],
  todayYmd: string = manilaTodayYmd()
): boolean {
  if (noticesSent[milestone]) return false;
  const until = daysUntilContractEnd(contractEndYmd, todayYmd);
  if (milestone === 't_minus_15') return until === 15;
  if (milestone === 't_minus_7') return until === 7;
  return until === 1;
}

/** T+0…T+4 inclusive — grace after archive. */
export function isInGracePeriod(
  contractEndYmd: string,
  todayYmd: string = manilaTodayYmd()
): boolean {
  const since = daysSinceContractEnd(contractEndYmd, todayYmd);
  return since != null && since >= 0 && since <= GRACE_DAYS_INCLUSIVE;
}

export function shouldArchiveAtT0(
  contractEndYmd: string,
  noticesSent: ContractLegLifecycle['noticesSent'],
  todayYmd: string = manilaTodayYmd()
): boolean {
  if (noticesSent.t_plus_0_archived) return false;
  const since = daysSinceContractEnd(contractEndYmd, todayYmd);
  return since != null && since >= 0;
}

export function shouldSendGraceReminder(
  contractEndYmd: string,
  noticesSent: ContractLegLifecycle['noticesSent'],
  todayYmd: string = manilaTodayYmd()
): boolean {
  if (noticesSent.t_plus_3) return false;
  const since = daysSinceContractEnd(contractEndYmd, todayYmd);
  return since === GRACE_REMINDER_DAY;
}

export function hasActiveConsiderationGrant(
  lifecycle: ContractLegLifecycle,
  todayYmd: string = manilaTodayYmd()
): boolean {
  const { status, grantedUntil } = lifecycle.consideration;
  if (status !== 'granted' || !grantedUntil) return false;
  return grantedUntil >= todayYmd;
}

/** T+5 lock when no covering grant. */
export function shouldLockAtT5(
  contractEndYmd: string,
  lifecycle: ContractLegLifecycle,
  todayYmd: string = manilaTodayYmd()
): boolean {
  if (lifecycle.accessLockedAt) return false;
  if (hasActiveConsiderationGrant(lifecycle, todayYmd)) return false;
  const since = daysSinceContractEnd(contractEndYmd, todayYmd);
  return since != null && since >= LOCK_DAY_OFFSET;
}

export function isListingAccessLocked(lifecycle: ContractLegLifecycle): boolean {
  return Boolean(lifecycle.accessLockedAt);
}

/**
 * Temporary grant expired → revoke listing access (cron).
 * Only when status is still granted and grantedUntil is before today.
 */
export function shouldRevokeExpiredGrant(
  lifecycle: ContractLegLifecycle,
  todayYmd: string = manilaTodayYmd()
): boolean {
  const { status, grantedUntil } = lifecycle.consideration;
  if (status !== 'granted' || !grantedUntil) return false;
  if (lifecycle.noticesSent.grant_expired) return false;
  return grantedUntil < todayYmd;
}

/** Max grantedUntil (inclusive) from today. */
export function maxGrantedUntilYmd(todayYmd: string = manilaTodayYmd()): string {
  return addManilaDays(todayYmd, CONSIDERATION_MAX_DAYS);
}

export function validateGrantedUntil(
  value: string,
  todayYmd: string = manilaTodayYmd()
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Grant end date is required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Enter a valid date';
  if (trimmed < todayYmd) return 'Grant end date cannot be in the past';
  if (trimmed > maxGrantedUntilYmd(todayYmd)) {
    return `Grant cannot exceed ${CONSIDERATION_MAX_DAYS} days`;
  }
  return null;
}

export function canOwnerSubmitConsideration(
  lifecycle: ContractLegLifecycle,
  contractEndYmd: string | null,
  todayYmd: string = manilaTodayYmd()
): { ok: true } | { ok: false; reason: string } {
  if (!contractEndYmd) return { ok: false, reason: 'No contract end date' };
  if (!isInGracePeriod(contractEndYmd, todayYmd)) {
    return { ok: false, reason: 'Consideration is only available during the grace period' };
  }
  if (isListingAccessLocked(lifecycle) && !lifecycle.consideration.allowConsiderationOverride) {
    return { ok: false, reason: 'Listing access is locked' };
  }
  if (lifecycle.consideration.selfServeUsedThisCycle) {
    return { ok: false, reason: 'Consideration already used this cycle' };
  }
  if (lifecycle.consideration.status === 'pending') {
    return { ok: false, reason: 'Consideration already pending' };
  }
  if (hasActiveConsiderationGrant(lifecycle, todayYmd)) {
    return { ok: false, reason: 'An active grant is already in effect' };
  }
  return { ok: true };
}

/** Reset consideration + notice markers when host sets a new contract end (full renew). */
export function resetLifecycleForNewContractCycle(
  _previous: ContractLegLifecycle
): ContractLegLifecycle {
  return emptyContractLegLifecycle();
}

export function markNoticeSent(
  lifecycle: ContractLegLifecycle,
  milestone: ContractNoticeMilestone,
  atIso: string = new Date().toISOString()
): ContractLegLifecycle {
  return {
    ...lifecycle,
    noticesSent: { ...lifecycle.noticesSent, [milestone]: atIso },
  };
}

/** Pre-expiry in-app reminder window (days before end, inclusive). Aligns with t_minus_15 email. */
export const PRE_EXPIRY_REMINDER_MAX_DAYS = 15;

export function isInPreExpiryWindow(
  contractEndYmd: string,
  todayYmd: string = manilaTodayYmd(),
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
  todayYmd: string = manilaTodayYmd()
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

export function appendConsiderationAudit(
  consideration: ContractConsideration,
  entry: Omit<ContractConsiderationAuditEntry, 'at'> & { at?: string }
): ContractConsideration {
  return {
    ...consideration,
    audit: [
      ...consideration.audit,
      {
        at: entry.at ?? new Date().toISOString(),
        by: entry.by,
        action: entry.action,
        note: entry.note ?? null,
      },
    ],
  };
}
