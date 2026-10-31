import type { LucideIcon } from 'lucide-react';

export const PROPERTY_ADMIN_ROLE_ID = 'ADMIN' as const;

export interface CustomPropertyRole {
  id: string;
  name: string;
  permissions: string[];
}

/** Stored member role: ADMIN (custom permissions) or a template UUID. */
export type PropertyRoleId = typeof PROPERTY_ADMIN_ROLE_ID | string;

export type TeamMemberStatus = 'active' | 'pending' | 'inactive';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  displayName: string;
  contactPhone: string;
  role: PropertyRoleId;
  permissions: string[];
  /** Snapshot restored on activate after deactivation */
  savedPermissions?: string[];
  status: TeamMemberStatus;
  /** True when inactive was set automatically by team-seat reconciliation (plan
   * downgrade/suspension), not by an admin — always false for org-inherited rows. */
  planLimited: boolean;
  assignedAt: string;
  lastActive: string | null;
  assignedBy: string;
  fromOrg: boolean;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: PropertyRoleId;
  permissions: string[];
  sentAt: string;
  expiresAt: string;
  sentBy: string;
}

export interface TeamPermission {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: LucideIcon;
}

export type TeamTab = 'members' | 'invitations' | 'permissions';

export type CustomRoleFormMode = 'create' | 'edit';
