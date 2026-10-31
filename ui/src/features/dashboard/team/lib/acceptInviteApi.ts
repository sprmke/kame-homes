import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

export type OrgTeamInvitePreview = {
  kind: 'org';
  orgName: string;
  logoUrl: string;
  inviteEmail: string;
  roleLabel: string;
};

export type PropertyTeamInvitePreview = {
  kind: 'property';
  orgName: string;
  propertyName: string;
  unitLabel: string;
  propertyLocation: string;
  logoUrl: string;
  inviteEmail: string;
  roleLabel: string;
};

export type ParkingTeamInvitePreview = {
  kind: 'parking';
  orgName: string;
  parkingName: string;
  parkingLocation: string;
  logoUrl: string;
  inviteEmail: string;
  roleLabel: string;
};

export type TeamInvitePreview =
  OrgTeamInvitePreview | PropertyTeamInvitePreview | ParkingTeamInvitePreview;

export async function fetchTeamInvitePreview(
  token: string,
  scope?: string | null
): Promise<TeamInvitePreview> {
  const params = new URLSearchParams({ token });
  if (scope === 'org') params.set('scope', 'org');
  if (scope === 'parking') params.set('scope', 'parking');
  if (scope === 'property') params.set('scope', 'property');
  const res = await fetch(`${FUNCTIONS_URL}/get-team-invite-preview?${params}`);
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: { preview?: TeamInvitePreview };
  };
  if (!res.ok || !json.success || !json.data?.preview) {
    throw new Error(json.error ?? 'Invitation not found');
  }
  return json.data.preview;
}

export type AcceptInviteResult =
  | {
      kind: 'property';
      propertyId: string;
      memberId: string;
      orgSlug: string;
      propertySlug: string;
      propertyName: string;
    }
  | {
      kind: 'parking';
      parkingId: string;
      memberId: string;
      orgSlug: string;
      parkingSlug: string;
      parkingName: string;
    }
  | {
      kind: 'org';
      organizationId: string;
      memberId: string;
      orgSlug: string;
      orgName: string;
    };

export async function acceptPropertyInvite(
  token: string
): Promise<Extract<AcceptInviteResult, { kind: 'property' }>> {
  const result = await callEdgeFunction<
    Omit<Extract<AcceptInviteResult, { kind: 'property' }>, 'kind'>
  >('accept-property-invite', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  return { kind: 'property', ...result };
}

export async function acceptParkingInvite(
  token: string
): Promise<Extract<AcceptInviteResult, { kind: 'parking' }>> {
  const result = await callEdgeFunction<
    Omit<Extract<AcceptInviteResult, { kind: 'parking' }>, 'kind'>
  >('accept-parking-invite', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  return { kind: 'parking', ...result };
}

export async function acceptOrgInvite(
  token: string
): Promise<Extract<AcceptInviteResult, { kind: 'org' }>> {
  const result = await callEdgeFunction<Omit<Extract<AcceptInviteResult, { kind: 'org' }>, 'kind'>>(
    'accept-org-invite',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    }
  );
  return { kind: 'org', ...result };
}
