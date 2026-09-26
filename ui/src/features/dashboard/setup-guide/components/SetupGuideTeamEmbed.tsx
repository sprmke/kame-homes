import { useCallback, useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import { useSetupGuide } from '@/features/dashboard/setup-guide/components/setupGuideContext';
import { useRegisterStepSave } from '@/features/dashboard/setup-guide/components/SetupGuideSaveContext';
import { SetupGuideStepSkeleton } from '@/features/dashboard/setup-guide/components/SetupGuideStepSkeleton';
import { useSetupGuideStateWrite } from '@/features/dashboard/setup-guide/hooks/useSetupGuideStateWrite';
import {
  defaultOrgInviteForm,
  type OrgInviteFormState,
} from '@/features/dashboard/team/components/OrgInviteMemberDialog';
import { OrgRoleListingAccessSection } from '@/features/dashboard/team/components/OrgRoleListingAccessSection';
import { RoleSelectOptions } from '@/features/dashboard/team/components/RoleSelectOptions';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { useOrgTeam, useOrgTeamMutations } from '@/features/dashboard/team/hooks/useOrgTeam';
import { hasOrgPermission } from '@/features/dashboard/team/lib/orgPermissions';
import {
  findOrgRoleById,
  orgRoleListingDefaults,
} from '@/features/dashboard/team/lib/orgRoleListingScope';
import { getOrgRolePermissions } from '@/features/dashboard/team/lib/orgTeamRoles';
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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';

export function SetupGuideTeamEmbed() {
  const { org, persisted } = useSetupGuide();
  const write = useSetupGuideStateWrite(org?.id);
  const orgId = org?.id ?? null;
  const { data: orgAccess } = useOrgPermissions();
  const { data, isLoading } = useOrgTeam(orgId);
  const { inviteMember } = useOrgTeamMutations(orgId);

  const canInvite = hasOrgPermission(orgAccess?.permissions, 'org.team.invitations:add');
  const customRoles = data?.customRoles ?? [];
  const members = data?.members ?? [];
  const sortedRoles = useMemo(() => sortOrgTemplatesForDisplay(customRoles), [customRoles]);

  const [form, setForm] = useState<OrgInviteFormState>(() => defaultOrgInviteForm(customRoles));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (form.permissions.length > 0) return;
    setForm((current) => ({
      ...current,
      permissions: getOrgRolePermissions(current.roleId, customRoles),
    }));
  }, [customRoles, form.permissions.length, form.roleId]);

  const listingSelectionValid =
    form.allListings ||
    form.listingAssignments.properties.length > 0 ||
    form.listingAssignments.parkings.length > 0;
  const emailInvalid = teamInviteEmailLooksInvalid(form.email);
  const phoneError = form.contactPhone.trim() ? teamInvitePhoneError(form.contactPhone) : null;
  const canSubmit =
    canInvite &&
    canSubmitTeamInvite({ email: form.email, contactPhone: form.contactPhone }, submitting) &&
    listingSelectionValid &&
    form.permissions.length > 0;

  const markReviewed = useCallback(async () => {
    const reviewed = new Set(persisted.reviewedSteps);
    reviewed.add('org.team');
    await write.setReviewedSteps([...reviewed]);
  }, [persisted.reviewedSteps, write]);

  const save = useCallback(async () => {
    await markReviewed();
    return true;
  }, [markReviewed]);
  useRegisterStepSave(save);

  const handleInvite = async () => {
    if (!canSubmit || !org) return;
    setSubmitting(true);
    try {
      await inviteMember.mutateAsync({
        email: form.email.trim(),
        contactPhone: form.contactPhone.trim(),
        roleId: form.roleId,
        permissions: form.permissions,
        allListings: form.allListings,
        listingAssignments: form.listingAssignments,
      });
      toast.success('Invitation sent');
      setForm(defaultOrgInviteForm(customRoles));
      await markReviewed();
    } catch (error) {
      toast.error((error as Error).message || 'Could not send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (!org || isLoading) {
    return <SetupGuideStepSkeleton kind="org.team" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {canInvite ? (
        <section className="surface-card space-y-4 p-4 sm:p-5">
          <h3 className="text-foreground text-sm font-semibold">Invite member</h3>
          <div className="space-y-2">
            <Label htmlFor="setup-guide-invite-email">Email</Label>
            <Input
              id="setup-guide-invite-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="user@gmail.com"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
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
            <Label htmlFor="setup-guide-invite-phone">Phone</Label>
            <Input
              id="setup-guide-invite-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.contactPhone}
              onChange={(event) =>
                setForm((current) => ({ ...current, contactPhone: event.target.value }))
              }
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
            <Label htmlFor="setup-guide-invite-role">Role</Label>
            <Select
              value={form.roleId}
              onValueChange={(value) => {
                handleRoleSelectChange(value, (roleId) => {
                  const role = findOrgRoleById(roleId, customRoles);
                  const listingDefaults = orgRoleListingDefaults(role);
                  setForm((current) => ({
                    ...current,
                    roleId,
                    permissions: getOrgRolePermissions(roleId, customRoles),
                    allListings: listingDefaults.allListings,
                    listingAssignments: listingDefaults.listingAssignments,
                  }));
                });
              }}
            >
              <SelectTrigger id="setup-guide-invite-role" className="h-10">
                <SelectValue>{getRoleLabelForScope('org', form.roleId, customRoles)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <RoleSelectOptions
                  scope="org"
                  customRoles={sortedRoles}
                  showAddCustomRole={false}
                  selectedRoleId={form.roleId}
                />
              </SelectContent>
            </Select>
          </div>
          <OrgRoleListingAccessSection
            orgSlug={org.slug}
            allListings={form.allListings}
            assignments={form.listingAssignments}
            onAllListingsChange={(allListings) =>
              setForm((current) => ({ ...current, allListings }))
            }
            onAssignmentsChange={(listingAssignments) =>
              setForm((current) => ({ ...current, listingAssignments }))
            }
          />
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={!canSubmit}
            onClick={() => void handleInvite()}
          >
            {submitting ? 'Sending…' : 'Send invite'}
          </Button>
        </section>
      ) : null}

      {members.length > 0 ? (
        <section className="surface-card p-4 sm:p-5">
          <h3 className="text-foreground text-sm font-semibold">Team</h3>
          <ul className="mt-3 space-y-2">
            {members.slice(0, 6).map((member) => (
              <li
                key={member.id}
                className="text-muted-foreground flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-foreground min-w-0 truncate">{member.email}</span>
                <span className="shrink-0 text-xs capitalize">
                  {member.role.replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
