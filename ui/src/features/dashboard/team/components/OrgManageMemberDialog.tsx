import { useEffect, useMemo, useState } from 'react';

import { EntityActivityHistory } from '@/features/dashboard/activity/components/EntityActivityHistory';
import {
  emptyOrgListingAssignments,
  type OrgListingAssignments,
} from '@/features/dashboard/team/components/OrgListingAssignmentPicker';
import { OrgRoleListingAccessSection } from '@/features/dashboard/team/components/OrgRoleListingAccessSection';
import { RoleSelectOptions } from '@/features/dashboard/team/components/RoleSelectOptions';
import {
  getOrgMemberRoleLabel,
  resolveOrgMemberTemplateRoleId,
} from '@/features/dashboard/team/lib/orgMemberRoleDisplay';
import {
  findOrgRoleById,
  orgRoleListingDefaults,
} from '@/features/dashboard/team/lib/orgRoleListingScope';
import { getOrgRolePermissions } from '@/features/dashboard/team/lib/orgTeamRoles';
import { sortOrgTemplatesForDisplay } from '@/features/dashboard/team/lib/orgTeamTemplates';
import { handleRoleSelectChange } from '@/features/dashboard/team/lib/roleSelectUtils';
import { getRoleLabelForScope } from '@/features/dashboard/team/lib/teamRoleHelpers';
import type {
  CustomOrgRole,
  OrgRoleId,
  OrgTeamMember,
} from '@/features/dashboard/team/types/orgTeam';

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

type Props = {
  open: boolean;
  orgSlug: string;
  member: OrgTeamMember | null;
  customRoles: CustomOrgRole[];
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    memberId: string;
    displayName: string;
    contactPhone: string;
    roleId: OrgRoleId;
    permissions: string[];
    allListings: boolean;
    listingAssignments: OrgListingAssignments;
  }) => Promise<boolean | void> | boolean | void;
  savePending?: boolean;
  onAddCustomRole?: () => void;
  showAddCustomRole?: boolean;
};

function assignmentsFromMember(member: OrgTeamMember): OrgListingAssignments {
  const raw = member.listingAssignments;
  return {
    properties: raw?.properties ?? [],
    parkings: raw?.parkings ?? [],
  };
}

export function OrgManageMemberDialog({
  open,
  orgSlug,
  member,
  customRoles,
  onOpenChange,
  onSave,
  savePending = false,
  onAddCustomRole,
  showAddCustomRole = false,
}: Props) {
  const sortedRoles = useMemo(() => sortOrgTemplatesForDisplay(customRoles), [customRoles]);
  const [displayName, setDisplayName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [roleId, setRoleId] = useState<OrgRoleId>('ADMIN');
  const [allListings, setAllListings] = useState(false);
  const [listingAssignments, setListingAssignments] = useState<OrgListingAssignments>(
    emptyOrgListingAssignments()
  );

  useEffect(() => {
    if (!member || !open) return;
    setDisplayName(member.displayName || member.name);
    setContactPhone(member.contactPhone);
    setRoleId(resolveOrgMemberTemplateRoleId(member, sortedRoles) as OrgRoleId);
    setAllListings(member.allListings);
    setListingAssignments(assignmentsFromMember(member));
  }, [member, open, sortedRoles]);

  const isOwnerMember = member?.isOwner ?? false;
  const rolePermissions = getOrgRolePermissions(roleId, customRoles);

  const listingSelectionValid =
    allListings ||
    listingAssignments.properties.length > 0 ||
    listingAssignments.parkings.length > 0;
  const canSave =
    !savePending && (isOwnerMember || (rolePermissions.length > 0 && listingSelectionValid));

  const savedListings = member ? assignmentsFromMember(member) : null;
  const isDirty =
    open &&
    member != null &&
    (displayName !== (member.displayName || member.name) ||
      contactPhone !== member.contactPhone ||
      roleId !== (resolveOrgMemberTemplateRoleId(member, sortedRoles) as OrgRoleId) ||
      allListings !== member.allListings ||
      JSON.stringify(listingAssignments) !== JSON.stringify(savedListings));

  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: async () => {
      if (!member || !canSave) return false;
      return (await onSave(buildSaveInput(member.id))) !== false;
    },
  });

  const buildSaveInput = (memberId: string) => ({
    memberId,
    displayName: displayName.trim(),
    contactPhone: contactPhone.trim(),
    roleId,
    permissions: rolePermissions,
    allListings,
    listingAssignments,
  });

  if (!member) return null;

  const resolvedRoleLabel = getOrgMemberRoleLabel(member, customRoles);

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={guardedOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),48rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,48rem)] sm:p-0"
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Manage Member
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-manage-display-name">Display name</Label>
                <Input
                  id="org-manage-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-manage-contact-phone">Phone</Label>
                <Input
                  id="org-manage-contact-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder={FORM_PLACEHOLDERS.phone}
                  className="h-10 tabular-nums"
                />
              </div>

              {isOwnerMember ? (
                <div className="space-y-2">
                  <Label htmlFor="org-manage-role">Role</Label>
                  <Input id="org-manage-role" value={resolvedRoleLabel} disabled className="h-10" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="org-manage-role">Role</Label>
                    <Select
                      value={roleId}
                      onValueChange={(value) => {
                        handleRoleSelectChange(
                          value,
                          (nextRoleId) => {
                            setRoleId(nextRoleId);
                            const listingDefaults = orgRoleListingDefaults(
                              findOrgRoleById(nextRoleId, customRoles)
                            );
                            setAllListings(listingDefaults.allListings);
                            setListingAssignments(listingDefaults.listingAssignments);
                          },
                          onAddCustomRole
                        );
                      }}
                    >
                      <SelectTrigger id="org-manage-role" className="h-10">
                        <SelectValue>
                          {getRoleLabelForScope('org', roleId, customRoles)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <RoleSelectOptions
                          scope="org"
                          customRoles={sortedRoles}
                          showAddCustomRole={showAddCustomRole}
                          selectedRoleId={roleId}
                        />
                      </SelectContent>
                    </Select>
                  </div>

                  <OrgRoleListingAccessSection
                    orgSlug={orgSlug}
                    allListings={allListings}
                    assignments={listingAssignments}
                    onAllListingsChange={setAllListings}
                    onAssignmentsChange={setListingAssignments}
                  />
                </>
              )}

              <EntityActivityHistory
                targetType="member"
                targetId={member.id}
                className="border-border/60 border-t pt-4"
                initialLimit={5}
              />
            </div>
          </div>

          <ResponsiveModalFooter className="border-border/60 shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <Button variant="outline" className="min-h-[44px]" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={!canSave}
              onClick={() => void onSave(buildSaveInput(member.id))}
            >
              Save
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
