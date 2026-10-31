/**
 * Shared Meta inbox connect finalization + Page picker helpers.
 */

import { encryptMetaInboxToken } from './metaInboxCrypto.ts';
import {
  prepareOrgMetaInboxConnect,
  prepareParkingMetaInboxConnect,
  preparePropertyMetaInboxConnect,
} from './metaInboxLifecycle.ts';
import {
  fetchMetaUserPages,
  persistMetaPageConnection,
  type MetaPageAccount,
} from './metaInboxGraph.ts';
import { getOrgDefaultFacebookConnection } from './metaInboxScope.ts';
import { socialInboxDb } from './socialInboxDb.ts';
import { ensureSocialInboxSettings } from './socialInboxService.ts';
import { seedDefaultInboxQuickRepliesIfEmpty } from './inboxDefaultQuickReplies.ts';

export type MetaPagePickerOption = {
  id: string;
  name: string;
  profileImageUrl: string | null;
  hasInstagram: boolean;
};

export type MetaInboxConnectScope = {
  propertyId?: string | null;
  parkingId?: string | null;
};

export function metaPagesForPicker(pages: MetaPageAccount[]): MetaPagePickerOption[] {
  return pages.map((page) => ({
    id: page.id,
    name: page.name,
    profileImageUrl: page.picture?.data?.url ?? null,
    hasInstagram: Boolean(page.instagram_business_account?.id),
  }));
}

async function resetBackfillForFacebookRow(facebookConnectionId: string): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();
  await sb
    .from('social_channel_connections')
    .update({
      meta_backfill_done: false,
      meta_backfill_phase: 'messenger',
      meta_backfill_next_url: null,
      last_sync_at: null,
      updated_at: now,
    })
    .eq('id', facebookConnectionId);
}

/** Persist Page + IG connection only — backfill runs via `meta-inbox-backfill`. */
export async function connectMetaInboxPage(
  orgId: string,
  page: MetaPageAccount,
  scope: MetaInboxConnectScope = {}
): Promise<void> {
  const propertyId = scope.propertyId ?? null;
  const parkingId = scope.parkingId ?? null;
  if (propertyId && parkingId) {
    throw new Error('Cannot set both property and parking Meta scope');
  }

  await ensureSocialInboxSettings(orgId);

  // First Meta connect from a property becomes the org default (no org Inbox UI).
  let writePropertyId = propertyId;
  let writeParkingId = parkingId;
  if (propertyId) {
    const orgDefault = await getOrgDefaultFacebookConnection(orgId);
    if (!orgDefault || orgDefault.status !== 'connected') {
      writePropertyId = null;
      writeParkingId = null;
      await prepareOrgMetaInboxConnect(orgId, { nextPageId: page.id });
    } else {
      await preparePropertyMetaInboxConnect(orgId, propertyId, { nextPageId: page.id });
    }
  } else if (parkingId) {
    await prepareParkingMetaInboxConnect(orgId, parkingId, { nextPageId: page.id });
  } else {
    await prepareOrgMetaInboxConnect(orgId, { nextPageId: page.id });
  }

  const { facebook } = await persistMetaPageConnection(orgId, page, {
    propertyId: writePropertyId,
    parkingId: writeParkingId,
  });
  await resetBackfillForFacebookRow(facebook.id);

  if (!writePropertyId && !writeParkingId) {
    await seedDefaultInboxQuickRepliesIfEmpty(orgId);
  }
}

/** @deprecated Prefer connectMetaInboxPage — org-default only. */
export async function connectOrgMetaInboxPage(orgId: string, page: MetaPageAccount): Promise<void> {
  await connectMetaInboxPage(orgId, page);
}

export async function encryptMetaUserToken(userToken: string): Promise<string> {
  return encryptMetaInboxToken(userToken);
}

export async function resolveMetaPageFromUserToken(
  userToken: string,
  pageId: string
): Promise<MetaPageAccount | null> {
  const pages = await fetchMetaUserPages(userToken);
  return pages.find((p) => p.id === pageId) ?? null;
}
