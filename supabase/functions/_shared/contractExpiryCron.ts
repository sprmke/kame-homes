/**
 * Daily Manila contract-expiry cron.
 * Notices T−15/T−7/T−1; T+0 archive; T+3 reminder; T+5 lock; grant expiry revoke.
 *
 * Scans **listing rows** (properties + parkings), each carrying its own rights, contract end
 * date, and lifecycle in settings.listingAuthorization. Only the expiring listing is archived —
 * siblings in the same org are untouched.
 */

import { createClient, type SupabaseClient } from './supabaseJs.ts';
import { verifyCronSecret } from './cronSecretGate.ts';

import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import {
  hasActiveConsiderationGrant,
  isContractLifecycleApplicable,
  markNoticeSent,
  shouldArchiveAtT0,
  shouldLockAtT5,
  shouldRevokeExpiredGrant,
  shouldSendGraceReminder,
  shouldSendPreExpiryNotice,
  type ContractLegLifecycle,
  type ContractNoticeMilestone,
} from './contractLifecycle.ts';
import { sendContractLifecycleNoticeEmail } from './contractLifecycleEmail.ts';
import {
  listingAuthorizationToSettingsValue,
  listingTableForKind,
  resolveListingAuthorization,
  type ListingAuthorizationState,
  type ListingKind,
} from './listingAuthorization.ts';
import { resolveSupabaseServiceRoleKey, resolveSupabaseUrl } from './supabaseRuntimeEnv.ts';

export function verifyContractExpiryCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'CONTRACT_EXPIRY_CRON_SECRET',
    headerName: 'x-contract-expiry-cron-secret',
  });
}

type OrgRow = {
  id: string;
  name: string;
  owner_id: string;
  settings: Record<string, unknown> | null;
};

type ListingRow = {
  id: string;
  name: string;
  status: string;
  organization_id: string;
  settings: Record<string, unknown> | null;
};

type ListingTarget = {
  listingKind: ListingKind;
  listing: ListingRow;
  org: OrgRow;
};

async function persistLifecycle(
  supabase: SupabaseClient,
  target: ListingTarget,
  authorization: ListingAuthorizationState
): Promise<void> {
  const current =
    target.listing.settings && typeof target.listing.settings === 'object'
      ? target.listing.settings
      : {};
  const settings = {
    ...current,
    listingAuthorization: listingAuthorizationToSettingsValue(authorization),
  };
  const { error } = await supabase
    .from(listingTableForKind(target.listingKind))
    .update({ settings })
    .eq('id', target.listing.id);
  if (error) {
    throw new Error(`Failed to save listing ${target.listing.id}: ${error.message}`);
  }
  target.listing.settings = settings;
}

/** Archive this listing only. */
async function setListingInactive(
  supabase: SupabaseClient,
  target: ListingTarget
): Promise<number> {
  if (target.listing.status !== 'ACTIVE') return 0;
  const { data, error } = await supabase
    .from(listingTableForKind(target.listingKind))
    .update({ status: 'INACTIVE' })
    .eq('id', target.listing.id)
    .eq('status', 'ACTIVE')
    .select('id');
  if (error) {
    throw new Error(`Failed to archive listing ${target.listing.id}: ${error.message}`);
  }
  if (data?.length) target.listing.status = 'INACTIVE';
  return data?.length ?? 0;
}

async function notifySafe(
  supabase: SupabaseClient,
  target: ListingTarget,
  contractEndYmd: string,
  milestone: Parameters<typeof sendContractLifecycleNoticeEmail>[0]['milestone']
): Promise<boolean> {
  try {
    await sendContractLifecycleNoticeEmail({
      supabase,
      ownerId: target.org.owner_id,
      organizationName: target.org.name,
      leg: target.listingKind,
      listingName: target.listing.name,
      contractEndYmd,
      milestone,
    });
    return true;
  } catch (err) {
    console.error(
      '[contractExpiryCron] email failed',
      target.listing.id,
      target.listingKind,
      milestone,
      err
    );
    return false;
  }
}

async function processListing(
  supabase: SupabaseClient,
  target: ListingTarget,
  todayYmd: string,
  counters: Record<string, number>
): Promise<void> {
  const authorization = resolveListingAuthorization(
    target.listing.settings,
    target.org.settings,
    target.listingKind
  );

  if (!isContractLifecycleApplicable(authorization.relationship)) return;
  const contractEndYmd = authorization.contractEndDate;
  if (!contractEndYmd) return;

  let life: ContractLegLifecycle = authorization.lifecycle;
  let dirty = false;
  const nowIso = new Date().toISOString();

  const preNotices: Array<'t_minus_15' | 't_minus_7' | 't_minus_1'> = [
    't_minus_15',
    't_minus_7',
    't_minus_1',
  ];
  for (const milestone of preNotices) {
    if (!shouldSendPreExpiryNotice(contractEndYmd, milestone, life.noticesSent, todayYmd)) {
      continue;
    }
    const sent = await notifySafe(supabase, target, contractEndYmd, milestone);
    if (sent) {
      life = markNoticeSent(life, milestone, nowIso);
      dirty = true;
      counters.notices += 1;
    }
  }

  if (shouldArchiveAtT0(contractEndYmd, life.noticesSent, todayYmd)) {
    if (!hasActiveConsiderationGrant(life, todayYmd)) {
      counters.archived += await setListingInactive(supabase, target);
    }
    const sent = await notifySafe(supabase, target, contractEndYmd, 't_plus_0_archived');
    life = markNoticeSent(life, 't_plus_0_archived', nowIso);
    dirty = true;
    if (sent) counters.notices += 1;
  }

  if (shouldSendGraceReminder(contractEndYmd, life.noticesSent, todayYmd)) {
    const sent = await notifySafe(supabase, target, contractEndYmd, 't_plus_3');
    if (sent) {
      life = markNoticeSent(life, 't_plus_3', nowIso);
      dirty = true;
      counters.notices += 1;
    }
  }

  if (shouldRevokeExpiredGrant(life, todayYmd)) {
    await setListingInactive(supabase, target);
    life = {
      ...life,
      accessLockedAt: life.accessLockedAt ?? nowIso,
      consideration: {
        ...life.consideration,
        status: 'denied',
        grantedUntil: null,
      },
    };
    life = markNoticeSent(life, 'grant_expired' satisfies ContractNoticeMilestone, nowIso);
    dirty = true;
    counters.grantExpired += 1;
    const sent = await notifySafe(supabase, target, contractEndYmd, 'grant_expired');
    if (sent) counters.notices += 1;
  }

  if (shouldLockAtT5(contractEndYmd, life, todayYmd)) {
    await setListingInactive(supabase, target);
    life = { ...life, accessLockedAt: nowIso };
    life = markNoticeSent(life, 't_plus_5_locked', nowIso);
    dirty = true;
    counters.locked += 1;
    const sent = await notifySafe(supabase, target, contractEndYmd, 't_plus_5_locked');
    if (sent) counters.notices += 1;
  }

  if (dirty) {
    await persistLifecycle(supabase, target, { ...authorization, lifecycle: life });
    counters.updated += 1;
  }
}

async function loadListings(
  supabase: SupabaseClient,
  listingKind: ListingKind,
  orgsById: Map<string, OrgRow>
): Promise<ListingTarget[]> {
  const { data, error } = await supabase
    .from(listingTableForKind(listingKind))
    .select('id, name, status, organization_id, settings');
  if (error) throw new Error(`list ${listingKind} failed: ${error.message}`);

  const targets: ListingTarget[] = [];
  for (const row of data ?? []) {
    const listing = row as ListingRow;
    const org = orgsById.get(listing.organization_id);
    if (!org) continue;
    targets.push({ listingKind, listing, org });
  }
  return targets;
}

export async function runContractExpiryCron(): Promise<Record<string, unknown>> {
  const supabase = createClient(resolveSupabaseUrl(), resolveSupabaseServiceRoleKey());
  const todayYmd = manilaTodayYmd();

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, owner_id, settings');
  if (error) throw new Error(`list orgs failed: ${error.message}`);

  const orgsById = new Map<string, OrgRow>();
  for (const row of orgs ?? []) {
    const org = row as OrgRow;
    orgsById.set(org.id, org);
  }

  const targets = [
    ...(await loadListings(supabase, 'property', orgsById)),
    ...(await loadListings(supabase, 'parking', orgsById)),
  ];

  const counters = {
    scanned: 0,
    updated: 0,
    notices: 0,
    archived: 0,
    locked: 0,
    grantExpired: 0,
  };

  for (const target of targets) {
    counters.scanned += 1;
    await processListing(supabase, target, todayYmd, counters);
  }

  return { todayYmd, ...counters };
}
