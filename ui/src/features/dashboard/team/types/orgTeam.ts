import type { CustomPropertyRole } from '@/features/dashboard/team/types/propertyTeam';

export type OrgRoleId = 'OWNER' | 'ADMIN' | string;

export type OrgTeamMemberStatus = 'active' | 'inactive';

export type OrgListingAssignmentsPayload = {
  properties?: Array<{ propertyId: string; roleId: string; permissions: string[] }>;
  parkings?: Array<{ parkingId: string; roleId: string; permissions: string[] }>;
};

export interface OrgTeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  displayName: string;
  contactPhone: string;
  role: OrgRoleId;
  permissions: string[];
  allListings: boolean;
  listingAssignments: OrgListingAssignmentsPayload | null;
  listingScopeSummary: string;
  status: OrgTeamMemberStatus;
  assignedAt: string;
  lastActive: string | null;
  assignedBy: string;
  isOwner: boolean;
  planLimited: boolean;
}

export interface OrgTeamInvitation {
  id: string;
  email: string;
  role: OrgRoleId;
  permissions: string[];
  allListings: boolean;
  listingAssignments: OrgListingAssignmentsPayload | null;
  listingScopeSummary: string;
  sentAt: string;
  expiresAt: string;
  sentBy: string;
}

export type CustomOrgRole = CustomPropertyRole & {
  allListings?: boolean;
  listingAssignments?: OrgListingAssignmentsPayload | null;
};

export type OrgTeamTab = 'members' | 'invitations' | 'permissions';

export type OrgTeamAccess = {
  canManage: boolean;
  accessKind: 'owner' | 'platform_admin' | 'org_admin';
};
