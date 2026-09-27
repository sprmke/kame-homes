import { useEffect, useMemo } from 'react';

import { Mail } from 'lucide-react';

import { useOpenDraftDirty } from '@/features/dashboard/lib/useOpenDraftDirty';
import type { OrgListingAssignments } from '@/features/dashboard/team/components/OrgListingAssignmentPicker';
import { OrgRoleListingAccessSection } from '@/features/dashboard/team/components/OrgRoleListingAccessSection';
import { RoleSelectOptions } from '@/features/dashboard/team/components/RoleSelectOptions';
import {
  findOrgRoleById,
  orgRoleListingDefaults,
} from '@/features/dashboard/team/lib/orgRoleListingScope';
import { getOrgRolePermissions } from '@/features/dashboard/team/lib/orgTeamRoles';
import { defaultOrgInviteTemplateId } from '@/features/dashboard/team/lib/orgTeamRoles';
import { sortOrgTemplatesForDisplay } from '@/features/dashboard/team/lib/orgTeamTemplates';
import { handleRoleSelectChange } from '@/features/dashboard/team/lib/roleSelectUtils';
import {
  canSubmitTeamInvite,
  teamInvitePhoneError,
} from '@/features/dashboard/team/lib/teamInviteContact';
import {
  TEAM_INVITE_GMAIL_ONLY_MESSAGE,
  teamInviteEmailLooksInvalid,
} from '@/features/dashboard/team/lib/teamInviteEmail';
import { getRoleLabelForScope } from '@/features/dashboard/team/lib/teamRoleHelpers';
import type { CustomOrgRole, OrgRoleId } from '@/features/dashboard/team/types/orgTeam';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';

export type OrgInviteFormState = {
  email: string;
  contactPhone: string;
  roleId: OrgRoleId;
  permissions: string[];
  allListings: boolean;
  listingAssignments: OrgListingAssignments;
};

type Props = {
  open: boolean;
  orgSlug: string;
  customRoles: CustomOrgRole[];
  onOpenChange: (open: boolean) => void;
  form: OrgInviteFormState;
  onFormChange: (patch: Partial<OrgInviteFormState>) => void;
  onSubmit: () => Promise<boolean | void> | boolean | void;
  submitPending?: boolean;
  onAddCustomRole?: () => void;
  showAddCustomRole?: boolean;
};

export function OrgInviteMemberDialog({
  open,
  orgSlug,
  customRoles,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  submitPending = false,
  onAddCustomRole,
  showAddCustomRole = false,
}: Props) {
  const sortedRoles = useMemo(() => sortOrgTemplatesForDisplay(customRoles), [customRoles]);
  const listingSelectionValid =
    form.allListings ||
    form.listingAssignments.properties.length > 0 ||
    form.listingAssignments.parkings.length > 0;

  const emailInvalid = teamInviteEmailLooksInvalid(form.email);
  const phoneError = form.contactPhone.trim() ? teamInvitePhoneError(form.contactPhone) : null;
  const canSubmit =
    canSubmitTeamInvite({ email: form.email, contactPhone: form.contactPhone }, submitPending) &&
    listingSelectionValid &&
    form.permissions.length > 0;

  const isDirty = useOpenDraftDirty(open, {
    email: form.email,
    contactPhone: form.contactPhone,
    roleId: form.roleId,
    allListings: form.allListings,
    listingAssignments: form.listingAssignments,
  });
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: async () => {
      if (!canSubmit) return false;
      return (await onSubmit()) !== false;
    },
  });

  useEffect(() => {
    if (!open) return;
    if (form.permissions.length > 0) return;
    onFormChange({
      permissions: getOrgRolePermissions(form.roleId, customRoles),
    });
  }, [open, form.permissions.length, form.roleId, customRoles, onFormChange]);

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),48rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,48rem)] sm:p-0"
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Invite Team Member
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-invite-email">Email</Label>
                <Input
                  id="org-invite-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="user@gmail.com"
                  value={form.email}
                  onChange={(e) => onFormChange({ email: e.target.value })}
                  className={cn('h-10', emailInvalid && 'border-destructive')}
                  aria-invalid={emailInvalid}
                />
                {emailInvalid ? (
                  <p className="text-destructive text-sm" role="alert">
                    {TEAM_INVITE_GMAIL_ONLY_MESSAGE}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-invite-contact-phone">Phone</Label>
                <Input
                  id="org-invite-contact-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.contactPhone}
                  onChange={(e) => onFormChange({ contactPhone: e.target.value })}
                  placeholder={FORM_PLACEHOLDERS.phone}
                  className={cn('h-10 tabular-nums', phoneError && 'border-destructive')}
                  aria-invalid={Boolean(phoneError)}
                />
                {phoneError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {phoneError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-invite-role">Role</Label>
                <Select
                  value={form.roleId}
                  onValueChange={(value) => {
                    handleRoleSelectChange(
                      value,
                      (roleId) => {
                        const role = findOrgRoleById(roleId, customRoles);
                        const listingDefaults = orgRoleListingDefaults(role);
                        onFormChange({
                          roleId,
                          permissions: getOrgRolePermissions(roleId, customRoles),
                          allListings: listingDefaults.allListings,
                          listingAssignments: listingDefaults.listingAssignments,
                        });
                      },
                      onAddCustomRole
                    );
                  }}
                >
                  <SelectTrigger id="org-invite-role" className="h-10">
                    <SelectValue>
                      {getRoleLabelForScope('org', form.roleId, customRoles)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <RoleSelectOptions
                      scope="org"
                      customRoles={sortedRoles}
                      showAddCustomRole={showAddCustomRole}
                      selectedRoleId={form.roleId}
                    />
                  </SelectContent>
                </Select>
              </div>

              <OrgRoleListingAccessSection
                orgSlug={orgSlug}
                allListings={form.allListings}
                assignments={form.listingAssignments}
                onAllListingsChange={(allListings) => onFormChange({ allListings })}
                onAssignmentsChange={(listingAssignments) => onFormChange({ listingAssignments })}
              />
            </div>
          </div>

          <ResponsiveModalFooter className="border-border/60 shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <Button variant="outline" className="min-h-[44px]" onClick={requestClose}>
              Cancel
            </Button>
            <Button className="min-h-[44px]" onClick={onSubmit} disabled={!canSubmit}>
              <Mail className="mr-2 size-4" aria-hidden />
              Send Invitation
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}

export function defaultOrgInviteForm(customRoles: CustomOrgRole[] = []): OrgInviteFormState {
  const roleId = defaultOrgInviteTemplateId(customRoles);
  const role = findOrgRoleById(roleId, customRoles);
  const listingDefaults = orgRoleListingDefaults(role);
  return {
    email: '',
    contactPhone: '',
    roleId,
    permissions: getOrgRolePermissions(roleId, customRoles),
    allListings: listingDefaults.allListings,
    listingAssignments: listingDefaults.listingAssignments,
  };
}

export function defaultOrgInviteRoleId(customRoles: CustomOrgRole[] = []): OrgRoleId {
  return defaultOrgInviteTemplateId(customRoles);
}
