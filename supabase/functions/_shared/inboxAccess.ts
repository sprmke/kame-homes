/**
 * Resolve Guest Inbox access for property or parking scope.
 * Org-level Inbox UI was removed — callers must pass property_id or parking_id.
 *
 * Phase 6 (property): maps capabilities to granular leaves.
 * Parking stays on coarse inbox:view / inbox:reply / inbox:manage until Phase 9.
 */

import { verifyParkingTeamAccess, verifyPropertyAccess, type OrgRow } from './orgAuth.ts';
import { INBOX_PHASE6_MANAGE_LEAF_IDS } from './accessPermissionExpansion.ts';
import type { ParkingTeamPermissionId } from './parkingTeamPermissions.ts';
import { hasPropertyPermission, type TeamPermissionId } from './propertyTeamPermissions.ts';
import type { InboxScopeFilter } from './socialInboxTypes.ts';

export type InboxAccessKind = 'property' | 'parking';

export type InboxAccessContext = {
  kind: InboxAccessKind;
  org: OrgRow;
  orgId: string;
  propertyId: string | null;
  parkingId: string | null;
  scope: InboxScopeFilter;
};

export type InboxCapability =
  | 'view'
  | 'reply'
  | 'manage'
  | 'channels_add'
  | 'channels_delete'
  | 'quick_replies'
  | 'quick_replies_add'
  | 'quick_replies_edit'
  | 'quick_replies_delete'
  | 'automation';

const PARKING_SCOPE_PERM: Record<'view' | 'reply' | 'manage', ParkingTeamPermissionId> = {
  view: 'inbox:view',
  reply: 'inbox:reply',
  manage: 'inbox:manage',
};

const QUICK_REPLY_LEAVES: TeamPermissionId[] = [
  'inbox.quickReplies:add',
  'inbox.quickReplies:edit',
  'inbox.quickReplies:delete',
];

function forbidden(): never {
  throw new Response(JSON.stringify({ success: false, error: 'Access restricted' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

function propertyPermissionForCapability(
  capability: InboxCapability
): TeamPermissionId | 'any_manage' | 'any_quick_replies' {
  switch (capability) {
    case 'view':
      return 'inbox:view';
    case 'reply':
      return 'inbox.messages:edit';
    case 'manage':
      return 'any_manage';
    case 'channels_add':
      return 'inbox.channels:add';
    case 'channels_delete':
      return 'inbox.channels:delete';
    case 'quick_replies':
      return 'any_quick_replies';
    case 'quick_replies_add':
      return 'inbox.quickReplies:add';
    case 'quick_replies_edit':
      return 'inbox.quickReplies:edit';
    case 'quick_replies_delete':
      return 'inbox.quickReplies:delete';
    case 'automation':
      return 'inbox.automation:edit';
  }
}

function parkingCapability(capability: InboxCapability): 'view' | 'reply' | 'manage' {
  if (capability === 'view') return 'view';
  if (capability === 'reply') return 'reply';
  return 'manage';
}

function readScopeFromUrl(url: URL): { propertyId: string | null; parkingId: string | null } {
  const propertyId = url.searchParams.get('property_id')?.trim() || null;
  const parkingId = url.searchParams.get('parking_id')?.trim() || null;
  return { propertyId, parkingId };
}

function readScopeFromBody(body: Record<string, unknown> | null | undefined): {
  propertyId: string | null;
  parkingId: string | null;
} {
  const propertyId =
    typeof body?.propertyId === 'string'
      ? body.propertyId.trim()
      : typeof body?.property_id === 'string'
        ? body.property_id.trim()
        : null;
  const parkingId =
    typeof body?.parkingId === 'string'
      ? body.parkingId.trim()
      : typeof body?.parking_id === 'string'
        ? body.parking_id.trim()
        : null;
  return {
    propertyId: propertyId || null,
    parkingId: parkingId || null,
  };
}

/**
 * Auth for inbox endpoints. Prefer URL query `property_id` / `parking_id`;
 * body fields are merged when provided (POST).
 */
export async function resolveInboxAccess(
  req: Request,
  capability: InboxCapability,
  body?: Record<string, unknown> | null
): Promise<InboxAccessContext> {
  const url = new URL(req.url);
  const fromUrl = readScopeFromUrl(url);
  const fromBody = readScopeFromBody(body);
  const propertyId = fromUrl.propertyId ?? fromBody.propertyId;
  const parkingId = fromUrl.parkingId ?? fromBody.parkingId;

  if (propertyId && parkingId) {
    throw new Response(
      JSON.stringify({ success: false, error: 'Pass only one of property_id or parking_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (propertyId) {
    const mapped = propertyPermissionForCapability(capability);
    if (mapped === 'any_manage') {
      const ctx = await verifyPropertyAccess(req, propertyId, 'inbox:view');
      const ok = (INBOX_PHASE6_MANAGE_LEAF_IDS as readonly string[]).some((id) =>
        hasPropertyPermission(ctx.permissions, id as TeamPermissionId)
      );
      if (!ok) forbidden();
      return {
        kind: 'property',
        org: ctx.org,
        orgId: ctx.org.id,
        propertyId,
        parkingId: null,
        scope: { propertyId, parkingId: null },
      };
    }
    if (mapped === 'any_quick_replies') {
      const ctx = await verifyPropertyAccess(req, propertyId, 'inbox:view');
      const ok = QUICK_REPLY_LEAVES.some((id) => hasPropertyPermission(ctx.permissions, id));
      if (!ok) forbidden();
      return {
        kind: 'property',
        org: ctx.org,
        orgId: ctx.org.id,
        propertyId,
        parkingId: null,
        scope: { propertyId, parkingId: null },
      };
    }
    const ctx = await verifyPropertyAccess(req, propertyId, mapped);
    return {
      kind: 'property',
      org: ctx.org,
      orgId: ctx.org.id,
      propertyId,
      parkingId: null,
      scope: { propertyId, parkingId: null },
    };
  }

  if (parkingId) {
    const ctx = await verifyParkingTeamAccess(
      req,
      parkingId,
      PARKING_SCOPE_PERM[parkingCapability(capability)]
    );
    return {
      kind: 'parking',
      org: ctx.org,
      orgId: ctx.org.id,
      propertyId: null,
      parkingId,
      scope: { propertyId: null, parkingId },
    };
  }

  throw new Response(
    JSON.stringify({
      success: false,
      error: 'property_id or parking_id is required',
    }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
