import { useEffect, useMemo, useRef, useState } from 'react';

import { useOpenDraftDirty } from '@/features/dashboard/lib/useOpenDraftDirty';
import { ApplyTemplatePicker } from '@/features/dashboard/team/components/ApplyTemplatePicker';
import { CustomRoleFormPreview } from '@/features/dashboard/team/components/CustomRoleFormPreview';
import type { OrgListingAssignments } from '@/features/dashboard/team/components/OrgListingAssignmentPicker';
import { OrgRoleListingAccessSection } from '@/features/dashboard/team/components/OrgRoleListingAccessSection';
import { PermissionsTreeView } from '@/features/dashboard/team/components/PermissionsTreeView';
import {
  buildCustomRoleFormSteps,
  clampCustomRoleFormStepIndex,
  customRoleFormStepLabels,
  findCustomRoleFormStepIndex,
  isCustomRoleNameValid,
} from '@/features/dashboard/team/lib/customRoleFormSteps';
import { ORG_PERMISSION_CATALOG } from '@/features/dashboard/team/lib/orgPermissionCatalog';
import { PROPERTY_PERMISSION_CATALOG } from '@/features/dashboard/team/lib/propertyPermissionCatalog';
import { getTeamScopeConfig, type TeamScope } from '@/features/dashboard/team/lib/teamScopeConfig';
import type { CustomPropertyRole } from '@/features/dashboard/team/types/propertyTeam';

import { FieldLabel } from '@/components/forms/FieldLabel';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { SegmentedStepProgress } from '@/components/wizard/SegmentedStepProgress';
import { WizardStepHeading } from '@/components/wizard/WizardStepHeading';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';

type Props = {
  scope?: TeamScope;
  open: boolean;
  mode: 'create' | 'edit';
  name: string;
  permissions: string[];
  /** Existing roles to use as a baseline when editing permissions. */
  roles?: CustomPropertyRole[];
  orgSlug?: string;
  allListings?: boolean;
  listingAssignments?: OrgListingAssignments;
  onAllListingsChange?: (value: boolean) => void;
  onListingAssignmentsChange?: (value: OrgListingAssignments) => void;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onTogglePermission: (permissionId: string) => void;
  onPermissionsChange?: (permissions: string[]) => void;
  onSubmit: () => Promise<boolean | void> | boolean | void;
  submitPending?: boolean;
};

export function CustomRoleFormDialog({
  scope = 'property',
  open,
  mode,
  name,
  permissions,
  roles = [],
  orgSlug,
  allListings = true,
  listingAssignments,
  onAllListingsChange,
  onListingAssignmentsChange,
  onOpenChange,
  onNameChange,
  onTogglePermission,
  onPermissionsChange,
  onSubmit,
  submitPending = false,
}: Props) {
  const [sensitivePendingId, setSensitivePendingId] = useState<string | null>(null);
  const [sensitiveResolver, setSensitiveResolver] = useState<((ok: boolean) => void) | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [nameError, setNameError] = useState<string | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isProperty = scope === 'property';
  const isOrg = scope === 'org';
  const isParking = scope === 'parking';
  const usesTree = isProperty || isOrg;
  const permissionCatalog = isOrg ? ORG_PERMISSION_CATALOG : PROPERTY_PERMISSION_CATALOG;
  const title = mode === 'create' ? 'New role' : 'Edit role';
  const config = getTeamScopeConfig(scope);
  const steps = useMemo(() => buildCustomRoleFormSteps({ scope }), [scope]);
  const stepLabels = useMemo(() => customRoleFormStepLabels(steps), [steps]);
  const safeStepIndex = clampCustomRoleFormStepIndex(stepIndex, steps.length);
  const activeStep = steps[safeStepIndex] ?? steps[0];
  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex === steps.length - 1;
  const detailsReady = isCustomRoleNameValid(name);
  const canGoNext = !submitPending && (activeStep?.kind !== 'details' || detailsReady);

  const grouped = useMemo(
    () =>
      config.categories.map((category) => ({
        category,
        items: config.permissions.filter((permission) => permission.category === category),
      })),
    [config.categories, config.permissions]
  );

  const parkingCategorySummaries = useMemo(
    () =>
      grouped.map(({ category, items }) => ({
        label: category,
        selected: items.filter((item) => permissions.includes(item.id)).length,
        total: items.length,
      })),
    [grouped, permissions]
  );

  const showListingStep =
    isOrg &&
    Boolean(orgSlug) &&
    Boolean(onAllListingsChange) &&
    Boolean(onListingAssignmentsChange) &&
    Boolean(listingAssignments);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setNameError(null);
    setPermissionsError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, safeStepIndex]);

  const requestSensitiveEnable = (permissionId: string): Promise<boolean> =>
    new Promise((resolve) => {
      setSensitivePendingId(permissionId);
      setSensitiveResolver(() => resolve);
    });

  const resolveSensitive = (ok: boolean) => {
    sensitiveResolver?.(ok);
    setSensitiveResolver(null);
    setSensitivePendingId(null);
  };

  const handleTreeChange = (next: string[]) => {
    setPermissionsError(null);
    if (onPermissionsChange) {
      onPermissionsChange(next);
      return;
    }
    const added = next.find((id) => !permissions.includes(id));
    const removed = permissions.find((id) => !next.includes(id));
    if (added) onTogglePermission(added);
    else if (removed) onTogglePermission(removed);
  };

  const isDirty = useOpenDraftDirty(open, {
    name,
    permissions: [...permissions].sort(),
    allListings,
    listingAssignments,
  });
  const { onOpenChange: guardedOpenChange, dialogProps } = useGuardedClose({
    open,
    onOpenChange,
    isDirty,
    onSave: () => handleSubmit(),
  });

  const handleOpenChange = (next: boolean) => {
    if (submitPending && !next) return;
    guardedOpenChange(next);
  };

  const goNext = () => {
    if (activeStep?.kind === 'details') {
      if (!isCustomRoleNameValid(name)) {
        setNameError('Enter a role name');
        nameInputRef.current?.focus();
        return;
      }
      setNameError(null);
    }
    if (activeStep?.kind === 'permissions') {
      if (permissions.length === 0) {
        setPermissionsError('Select at least one permission');
        return;
      }
      setPermissionsError(null);
    }
    setStepIndex((prev) => clampCustomRoleFormStepIndex(prev + 1, steps.length));
  };

  const goBack = () => {
    setNameError(null);
    setPermissionsError(null);
    setStepIndex((prev) => clampCustomRoleFormStepIndex(prev - 1, steps.length));
  };

  const handleSubmit = async (): Promise<boolean> => {
    if (!isCustomRoleNameValid(name)) {
      setNameError('Enter a role name');
      setStepIndex(findCustomRoleFormStepIndex(steps, 'details'));
      return false;
    }
    if (permissions.length === 0) {
      setPermissionsError('Select at least one permission');
      const permIndex = findCustomRoleFormStepIndex(steps, 'permissions');
      if (permIndex >= 0) setStepIndex(permIndex);
      return false;
    }
    setNameError(null);
    setPermissionsError(null);
    return (await onSubmit()) !== false;
  };

  return (
    <>
      <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className={cn(
            'flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-1.5rem),48rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,48rem)] sm:p-0'
          )}
          onPointerDownOutside={(event) => {
            if (submitPending) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (submitPending) event.preventDefault();
          }}
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              {title}
            </ResponsiveModalTitle>
            {steps.length > 1 ? (
              <nav aria-label="Role steps" className="mt-3">
                <SegmentedStepProgress labels={stepLabels} currentIndex={safeStepIndex} />
              </nav>
            ) : null}
          </ResponsiveModalHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            {activeStep?.kind !== 'listings' ? (
              <WizardStepHeading
                title={activeStep?.label ?? 'Details'}
                headingRef={stepHeadingRef}
                className="mb-4"
              />
            ) : (
              <h2 ref={stepHeadingRef} tabIndex={-1} className="sr-only">
                Listing access
              </h2>
            )}

            {activeStep?.kind === 'details' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel htmlFor="custom-role-name" label="Role name" required />
                  <Input
                    ref={nameInputRef}
                    id="custom-role-name"
                    value={name}
                    onChange={(e) => {
                      onNameChange(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder={isProperty ? 'e.g. Front desk' : 'e.g. Co-host'}
                    className="h-11"
                    maxLength={48}
                    autoComplete="off"
                    required
                    error={nameError != null}
                    aria-invalid={nameError != null}
                    aria-describedby={nameError ? 'custom-role-name-error' : undefined}
                  />
                  {nameError ? (
                    <p
                      id="custom-role-name-error"
                      className="text-destructive text-sm"
                      role="alert"
                    >
                      {nameError}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeStep?.kind === 'listings' && showListingStep ? (
              <OrgRoleListingAccessSection
                orgSlug={orgSlug!}
                allListings={allListings}
                assignments={listingAssignments!}
                onAllListingsChange={onAllListingsChange!}
                onAssignmentsChange={onListingAssignmentsChange!}
              />
            ) : null}

            {activeStep?.kind === 'permissions' ? (
              <div className="space-y-4">
                {roles.length > 0 && onPermissionsChange ? (
                  <ApplyTemplatePicker
                    permissions={permissions}
                    templates={roles}
                    permissionsOnly
                    onApply={(_roleId, nextPermissions) => {
                      setPermissionsError(null);
                      onPermissionsChange(nextPermissions);
                    }}
                  />
                ) : null}
                {usesTree ? (
                  <PermissionsTreeView
                    permissions={permissions}
                    onChange={handleTreeChange}
                    catalog={permissionCatalog}
                    onSensitiveEnable={requestSensitiveEnable}
                  />
                ) : (
                  <div className="space-y-3 rounded-lg border p-3">
                    {grouped.map(({ category, items }) => (
                      <div key={category}>
                        <p className="mb-2 text-sm font-medium">{category}</p>
                        <div className="space-y-2 pl-1">
                          {items.map((permission) => (
                            <div key={permission.id} className="flex min-h-11 items-center gap-2.5">
                              <Checkbox
                                id={`custom-role-${permission.id}`}
                                checked={permissions.includes(permission.id)}
                                onCheckedChange={() => {
                                  setPermissionsError(null);
                                  onTogglePermission(permission.id);
                                }}
                                className="size-5"
                              />
                              <Label
                                htmlFor={`custom-role-${permission.id}`}
                                className="cursor-pointer text-sm font-normal leading-snug"
                              >
                                {permission.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {permissionsError ? (
                  <p className="text-destructive text-sm" role="alert">
                    {permissionsError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {activeStep?.kind === 'preview' ? (
              <CustomRoleFormPreview
                scope={scope}
                name={name}
                permissions={permissions}
                roles={roles}
                catalog={usesTree ? permissionCatalog : undefined}
                categorySummaries={isParking ? parkingCategorySummaries : undefined}
                allListings={allListings}
                listingAssignments={listingAssignments}
              />
            ) : null}
          </div>

          <ResponsiveModalFooter className="border-border/60 shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <div className="flex w-full flex-row items-center gap-2">
              <div className="flex min-w-0 flex-1 justify-start">
                {!isFirstStep ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={goBack}
                    disabled={submitPending}
                  >
                    Back
                  </Button>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitPending}
                >
                  Cancel
                </Button>
                {!isLastStep ? (
                  <Button
                    type="button"
                    className="min-h-[44px]"
                    onClick={goNext}
                    disabled={!canGoNext}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="min-h-[44px]"
                    onClick={handleSubmit}
                    disabled={submitPending || !isCustomRoleNameValid(name)}
                  >
                    {submitPending
                      ? mode === 'create'
                        ? 'Creating…'
                        : 'Saving…'
                      : mode === 'create'
                        ? 'Create'
                        : 'Save'}
                  </Button>
                )}
              </div>
            </div>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={sensitivePendingId != null}
        onOpenChange={(next) => {
          if (!next) resolveSensitive(false);
        }}
      >
        <ResponsiveModalContent className="max-w-[min(calc(100vw-1.5rem),24rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Allow team management?</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground text-sm">
            This role can manage other members&apos; access.
          </p>
          <ResponsiveModalFooter className="gap-1">
            <Button variant="outline" onClick={() => resolveSensitive(false)}>
              Cancel
            </Button>
            <Button onClick={() => resolveSensitive(true)}>Allow</Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
