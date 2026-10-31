import type { OrgRoleId } from '@/features/dashboard/team/types/orgTeam';
import type {
  CustomPropertyRole,
  PropertyRoleId,
} from '@/features/dashboard/team/types/propertyTeam';

export type TeamContactMember = {
  name: string;
  email: string;
  displayName?: string;
  contactPhone?: string;
};

export type EditMemberContactSaveInput = {
  displayName: string;
  contactPhone: string;
  roleId?: string;
};

export type EditMemberOrgRoleConfig = {
  scope: 'org';
  roleId: OrgRoleId;
  /** Owner role cannot be changed. */
  locked: boolean;
  editable: boolean;
};

export type EditMemberPropertyRoleConfig = {
  scope: 'property';
  roleId: PropertyRoleId;
  customRoles: CustomPropertyRole[];
  editable: boolean;
  onAddCustomRole?: () => void;
};

export type EditMemberParkingRoleConfig = {
  scope: 'parking';
  roleId: PropertyRoleId;
  customRoles: CustomPropertyRole[];
  editable: boolean;
  onAddCustomRole?: () => void;
};

export type EditMemberRoleConfig =
  EditMemberOrgRoleConfig | EditMemberPropertyRoleConfig | EditMemberParkingRoleConfig;
