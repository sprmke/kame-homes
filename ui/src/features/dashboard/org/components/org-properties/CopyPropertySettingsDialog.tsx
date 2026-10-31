import { useEffect, useMemo, useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { useCopyPropertySettings } from '@/features/dashboard/org/hooks/useCopyPropertySettings';
import {
  copyPropertySettings,
  type CopyPropertySettingsResponse,
} from '@/features/dashboard/org/lib/copyPropertySettingsApi';
import {
  copyPropertySettingsGroupsByCategory,
  copyPropertySettingsGroupsForPhase,
  type CopyPropertySettingsGroupId,
  type CopyPropertySettingsGroupMeta,
} from '@/features/dashboard/org/lib/copyPropertySettingsGroups';
import { TierBadge, TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SegmentedStepProgress } from '@/components/wizard/SegmentedStepProgress';
import { WizardStepHeading } from '@/components/wizard/WizardStepHeading';
import { cn } from '@/lib/utils';

const STEP_LABELS = ['Source', 'Groups', 'Targets', 'Confirm'] as const;
type StepIndex = 0 | 1 | 2 | 3;

const PHASE_GROUPS = copyPropertySettingsGroupsForPhase(3);
const CATEGORY_SECTIONS = copyPropertySettingsGroupsByCategory(PHASE_GROUPS);

function categoryTriState(
  categoryGroups: CopyPropertySettingsGroupMeta[],
  selected: Set<CopyPropertySettingsGroupId>
): boolean | 'indeterminate' {
  const ids = categoryGroups.map((g) => g.id);
  const onCount = ids.filter((id) => selected.has(id)).length;
  if (onCount === 0) return false;
  if (onCount === ids.length) return true;
  return 'indeterminate';
}

export type CopyPropertySettingsDialogProperty = {
  id: string;
  name: string;
  tower?: string | null;
  unitNumber?: string | null;
  status?: string | null;
  planName?: string | null;
};

type CopyPropertySettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  properties: CopyPropertySettingsDialogProperty[];
  initialSourcePropertyId?: string | null;
  /** When set, this property is the only target (locked-target deep link). */
  lockedTargetPropertyId?: string | null;
  canEditProperty?: (propertyId: string) => boolean;
};

function propertyLabel(property: CopyPropertySettingsDialogProperty): string {
  const tower = property.tower?.trim();
  const unit = property.unitNumber?.trim();
  const towerUnit = [tower, unit].filter(Boolean).join(' ');
  if (towerUnit) return `${property.name} (${towerUnit})`;
  return property.name;
}

function defaultSelectedGroups(): Set<CopyPropertySettingsGroupId> {
  return new Set(PHASE_GROUPS.filter((g) => g.defaultOn).map((g) => g.id));
}

function CopySettingsStepper({ activeStep }: { activeStep: StepIndex }) {
  return (
    <nav aria-label="Copy settings steps">
      <SegmentedStepProgress labels={STEP_LABELS} currentIndex={activeStep} />
    </nav>
  );
}

function ReviewTargetRow({
  property,
  result,
}: {
  property: CopyPropertySettingsDialogProperty | undefined;
  result: CopyPropertySettingsResponse['results'][number];
}) {
  const name = property ? propertyLabel(property) : result.targetPropertyId;
  return (
    <div className="border-border/60 space-y-1 rounded-lg border px-3 py-2.5">
      <p className="text-foreground text-sm font-medium">{name}</p>
      <p className="text-muted-foreground text-xs tabular-nums">
        {result.applied.length} will copy
        {result.skipped.length > 0 ? ` · ${result.skipped.length} skipped` : ''}
        {result.failed.length > 0 ? ` · ${result.failed.length} failed` : ''}
        {result.alreadyCustomized.length > 0
          ? ` · ${result.alreadyCustomized.length} unchanged`
          : ''}
      </p>
    </div>
  );
}

export function CopyPropertySettingsDialog({
  open,
  onOpenChange,
  orgSlug,
  properties,
  initialSourcePropertyId = null,
  lockedTargetPropertyId = null,
  canEditProperty,
}: CopyPropertySettingsDialogProps) {
  const copyMutation = useCopyPropertySettings(orgSlug);
  const { open: openUpgradeModal } = useUpgradeModal();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState<StepIndex>(0);
  const [sourcePropertyId, setSourcePropertyId] = useState<string>('');
  const copyPlanGate = useFeatureGate('copyPropertySettings', sourcePropertyId || null);
  const [selectedGroups, setSelectedGroups] =
    useState<Set<CopyPropertySettingsGroupId>>(defaultSelectedGroups);
  const [copyEmailRecipients, setCopyEmailRecipients] = useState(false);
  const [copyTelegramCredentials, setCopyTelegramCredentials] = useState(false);
  /** When false, skip groups that already have values on the target. */
  const [overrideExisting, setOverrideExisting] = useState(true);
  const [confirmLargeBatch, setConfirmLargeBatch] = useState(false);
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [targetSearch, setTargetSearch] = useState('');
  const [dryRunResult, setDryRunResult] = useState<CopyPropertySettingsResponse | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);

  const propertyById = useMemo(() => {
    const map = new Map<string, CopyPropertySettingsDialogProperty>();
    for (const property of properties) map.set(property.id, property);
    return map;
  }, [properties]);

  const targetCandidates = useMemo(
    () => properties.filter((p) => p.id !== sourcePropertyId),
    [properties, sourcePropertyId]
  );

  const selectableTargets = useMemo(
    () => targetCandidates.filter((p) => (canEditProperty ? canEditProperty(p.id) : true)),
    [targetCandidates, canEditProperty]
  );

  const filteredTargetCandidates = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return targetCandidates;
    return targetCandidates.filter((property) => {
      const haystack = [
        property.name,
        property.tower,
        property.unitNumber,
        property.planName,
        property.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [targetCandidates, targetSearch]);

  const allSelectableSelected =
    selectableTargets.length > 0 &&
    selectableTargets.every((property) => targetIds.has(property.id));

  const buildRequest = (dryRun: boolean) => {
    const groups = Array.from(selectedGroups);
    return {
      sourcePropertyId,
      targetPropertyIds: Array.from(targetIds),
      groups,
      options: {
        copyContact: selectedGroups.has('contact'),
        copyEmailRecipients,
        copyTelegramCredentials,
        skipAlreadyCustomized: !overrideExisting,
      },
      dryRun,
    };
  };

  const resetState = (nextSourceId?: string | null) => {
    const sourceCandidates = properties.filter((p) => p.id !== lockedTargetPropertyId);
    const preferredFromArg =
      nextSourceId &&
      nextSourceId !== lockedTargetPropertyId &&
      sourceCandidates.some((p) => p.id === nextSourceId)
        ? nextSourceId
        : null;
    const preferred = preferredFromArg ?? sourceCandidates[0]?.id ?? '';
    setStep(0);
    setSourcePropertyId(preferred);
    setSelectedGroups(defaultSelectedGroups());
    setCopyEmailRecipients(false);
    setCopyTelegramCredentials(false);
    setOverrideExisting(true);
    setConfirmLargeBatch(false);
    setTargetIds(
      lockedTargetPropertyId && lockedTargetPropertyId !== preferred
        ? new Set([lockedTargetPropertyId])
        : new Set()
    );
    setTargetSearch('');
    setDryRunResult(null);
    setDryRunError(null);
    setDryRunLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    resetState(initialSourcePropertyId);
    // Only reset when the dialog opens or entry context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-context reset
  }, [open, initialSourcePropertyId, lockedTargetPropertyId]);

  useEffect(() => {
    if (!open || step !== 3) return;
    let cancelled = false;
    setDryRunLoading(true);
    setDryRunError(null);
    setDryRunResult(null);

    void copyPropertySettings(buildRequest(true))
      .then((data) => {
        if (cancelled) return;
        setDryRunResult(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Preview failed';
        setDryRunError(message || 'Preview failed');
      })
      .finally(() => {
        if (!cancelled) setDryRunLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Re-run only when entering review with current selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    stepHeadingRef.current?.focus();
  }, [open, step]);

  const canGoNext = (() => {
    if (step === 0) {
      if (!sourcePropertyId) return false;
      if (lockedTargetPropertyId && sourcePropertyId === lockedTargetPropertyId) return false;
      return true;
    }
    if (step === 1) return selectedGroups.size > 0;
    if (step === 2) {
      if (lockedTargetPropertyId) {
        return (
          Boolean(lockedTargetPropertyId) &&
          lockedTargetPropertyId !== sourcePropertyId &&
          targetIds.has(lockedTargetPropertyId)
        );
      }
      return targetIds.size > 0;
    }
    return false;
  })();

  const isCopying = copyMutation.isPending;
  /** Block dismiss only while a real copy is in flight (preview can be cancelled via Back). */
  const blockDismiss = isCopying;

  const handleOpenChange = (next: boolean) => {
    if (blockDismiss && !next) return;
    onOpenChange(next);
  };

  const runDryRunPreview = () => {
    setDryRunLoading(true);
    setDryRunError(null);
    setDryRunResult(null);
    void copyPropertySettings(buildRequest(true))
      .then((data) => {
        setDryRunResult(data);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Preview failed';
        setDryRunError(message || 'Preview failed');
      })
      .finally(() => {
        setDryRunLoading(false);
      });
  };

  const toggleGroup = (id: CopyPropertySettingsGroupId, checked: boolean) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    if (id === 'emailAutomations' && !checked) setCopyEmailRecipients(false);
    if (id === 'telegramNotifications' && !checked) setCopyTelegramCredentials(false);
  };

  const toggleCategory = (categoryGroups: CopyPropertySettingsGroupMeta[], checked: boolean) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      for (const group of categoryGroups) {
        if (checked) next.add(group.id);
        else next.delete(group.id);
      }
      return next;
    });
    if (!checked) {
      if (categoryGroups.some((g) => g.id === 'emailAutomations')) setCopyEmailRecipients(false);
      if (categoryGroups.some((g) => g.id === 'telegramNotifications')) {
        setCopyTelegramCredentials(false);
      }
    }
  };

  const toggleTarget = (id: string, checked: boolean) => {
    setTargetIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAllTargets = () => {
    setTargetIds(new Set(selectableTargets.map((p) => p.id)));
  };

  const clearTargetSelection = () => {
    setTargetIds(new Set());
  };

  const handleCopy = async () => {
    if (!copyPlanGate.canUse) {
      openUpgradeModal('copyPropertySettings');
      return;
    }
    try {
      await copyMutation.mutateAsync(buildRequest(false));
      onOpenChange(false);
    } catch {
      // toast handled in mutation onError
    }
  };

  const stepTitle = STEP_LABELS[step];

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className={cn(
          'flex max-h-[min(92dvh,40rem)] w-full max-w-[min(calc(100vw-1.5rem),32rem)] flex-col gap-0 overflow-hidden p-0',
          'sm:max-w-[min(94vw,32rem)] sm:p-0'
        )}
        aria-busy={isCopying || dryRunLoading || undefined}
        onPointerDownOutside={(event) => {
          if (blockDismiss) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (blockDismiss) event.preventDefault();
        }}
      >
        <ResponsiveModalHeader className="border-border/60 shrink-0 gap-0 border-b px-5 py-4 text-left sm:px-6">
          <ResponsiveModalTitle className="text-left">Copy settings</ResponsiveModalTitle>
          <div className="mt-4">
            <CopySettingsStepper activeStep={step} />
          </div>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch] sm:px-6">
          <WizardStepHeading title={stepTitle} headingRef={stepHeadingRef} className="mb-4" />

          {step === 0 ? (
            <div className="space-y-2">
              <Label htmlFor="copy-settings-source">Source property</Label>
              <Select
                value={sourcePropertyId || undefined}
                onValueChange={(value) => {
                  setSourcePropertyId(value);
                  setTargetIds((prev) => {
                    const next = new Set(prev);
                    next.delete(value);
                    if (lockedTargetPropertyId && lockedTargetPropertyId !== value) {
                      next.add(lockedTargetPropertyId);
                    }
                    return next;
                  });
                }}
              >
                <SelectTrigger id="copy-settings-source" className="min-h-[44px]">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties
                    .filter((property) => property.id !== lockedTargetPropertyId)
                    .map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {propertyLabel(property)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              {CATEGORY_SECTIONS.map((section) => {
                const parentState = categoryTriState(section.groups, selectedGroups);
                return (
                  <div key={section.category} className="space-y-1.5">
                    <div className="flex min-h-[44px] items-center gap-3">
                      <Checkbox
                        id={`copy-cat-${section.category}`}
                        checked={parentState}
                        onCheckedChange={(value) => toggleCategory(section.groups, value === true)}
                        aria-label={section.label}
                        className="size-5"
                      />
                      <Label
                        htmlFor={`copy-cat-${section.category}`}
                        className="text-foreground cursor-pointer text-sm font-semibold"
                      >
                        {section.label}
                      </Label>
                    </div>
                    <div className="border-border/50 ml-2 space-y-0.5 border-l pl-3">
                      {section.groups.map((group) => {
                        const inputId = `copy-group-${group.id}`;
                        const groupOn = selectedGroups.has(group.id);
                        return (
                          <div key={group.id} className="space-y-0.5">
                            <div className="flex min-h-[44px] items-center gap-3">
                              <Checkbox
                                id={inputId}
                                checked={groupOn}
                                onCheckedChange={(value) => toggleGroup(group.id, value === true)}
                                className="size-5"
                              />
                              <Label
                                htmlFor={inputId}
                                className="text-foreground flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm font-normal"
                              >
                                <span className="truncate">{group.label}</span>
                                {group.planFeature ? (
                                  <TierBadge feature={group.planFeature} />
                                ) : null}
                              </Label>
                            </div>
                            {group.id === 'emailAutomations' && groupOn ? (
                              <div className="ml-8 flex min-h-[44px] items-center gap-3">
                                <Checkbox
                                  id="copy-email-recipients"
                                  checked={copyEmailRecipients}
                                  onCheckedChange={(value) =>
                                    setCopyEmailRecipients(value === true)
                                  }
                                  className="size-5"
                                />
                                <Label
                                  htmlFor="copy-email-recipients"
                                  className="text-muted-foreground cursor-pointer text-sm font-normal"
                                >
                                  Include email recipients
                                </Label>
                              </div>
                            ) : null}
                            {group.id === 'telegramNotifications' && groupOn ? (
                              <div className="ml-8 flex min-h-[44px] items-center gap-3">
                                <Checkbox
                                  id="copy-telegram-credentials"
                                  checked={copyTelegramCredentials}
                                  onCheckedChange={(value) =>
                                    setCopyTelegramCredentials(value === true)
                                  }
                                  className="size-5"
                                />
                                <Label
                                  htmlFor="copy-telegram-credentials"
                                  className="text-muted-foreground cursor-pointer text-sm font-normal"
                                >
                                  Include Telegram credentials
                                </Label>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="border-border/60 space-y-1.5 border-t pt-3">
                <p className="text-foreground text-sm font-semibold">Options</p>
                <div className="flex min-h-[44px] items-center gap-3">
                  <Checkbox
                    id="override-existing-settings"
                    checked={overrideExisting}
                    onCheckedChange={(value) => setOverrideExisting(value === true)}
                    className="size-5"
                  />
                  <Label
                    htmlFor="override-existing-settings"
                    className="text-foreground cursor-pointer text-sm font-normal"
                  >
                    Override existing settings
                  </Label>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm tabular-nums">
                  {targetIds.size} of {selectableTargets.length}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] shrink-0"
                  disabled={selectableTargets.length === 0}
                  onClick={() => {
                    if (allSelectableSelected) clearTargetSelection();
                    else selectAllTargets();
                  }}
                >
                  {allSelectableSelected ? 'Clear' : 'Select all'}
                </Button>
              </div>
              {targetCandidates.length > 8 ? (
                <Input
                  value={targetSearch}
                  onChange={(event) => setTargetSearch(event.target.value)}
                  placeholder="Search"
                  aria-label="Search targets"
                  className="min-h-[44px]"
                />
              ) : null}
              <div
                className="border-border/60 max-h-[min(40dvh,18rem)] space-y-0.5 overflow-y-auto overscroll-contain rounded-lg border p-1.5"
                role="group"
                aria-label="Target properties"
              >
                {filteredTargetCandidates.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 text-sm">No matches</p>
                ) : (
                  filteredTargetCandidates.map((property) => {
                    const canEdit = canEditProperty ? canEditProperty(property.id) : true;
                    const inputId = `copy-target-${property.id}`;
                    return (
                      <div
                        key={property.id}
                        className={cn(
                          'flex min-h-[44px] items-center gap-3 rounded-md px-2',
                          !canEdit && 'opacity-50'
                        )}
                      >
                        <Checkbox
                          id={inputId}
                          checked={targetIds.has(property.id)}
                          disabled={!canEdit}
                          onCheckedChange={(value) => toggleTarget(property.id, value === true)}
                          className="size-5"
                        />
                        <Label
                          htmlFor={inputId}
                          className={cn(
                            'text-foreground min-w-0 flex-1 text-sm font-normal',
                            canEdit ? 'cursor-pointer' : 'cursor-not-allowed'
                          )}
                        >
                          <span className="block truncate">{propertyLabel(property)}</span>
                          {property.planName || property.status ? (
                            <span className="text-muted-foreground block truncate text-xs">
                              {[property.planName, property.status].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              {dryRunLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Building preview…
                </div>
              ) : null}
              {dryRunError ? (
                <div className="space-y-3">
                  <p className="text-destructive text-sm">{dryRunError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    disabled={dryRunLoading || isCopying}
                    onClick={runDryRunPreview}
                  >
                    Try again
                  </Button>
                </div>
              ) : null}
              {dryRunResult ? (
                <>
                  <p className="text-muted-foreground text-sm">
                    Per target: what will copy, stay unchanged, or fail.
                  </p>
                  {dryRunResult.results.map((result) => (
                    <ReviewTargetRow
                      key={result.targetPropertyId}
                      property={propertyById.get(result.targetPropertyId)}
                      result={result}
                    />
                  ))}
                </>
              ) : null}
              {!dryRunLoading && !dryRunError && !dryRunResult ? (
                <p className="text-muted-foreground text-sm">No preview yet.</p>
              ) : null}
              {targetIds.size > 10 && dryRunResult ? (
                <div className="flex min-h-[44px] items-center gap-3">
                  <Checkbox
                    id="confirm-large-batch"
                    checked={confirmLargeBatch}
                    onCheckedChange={(value) => setConfirmLargeBatch(value === true)}
                    className="size-5"
                  />
                  <Label
                    htmlFor="confirm-large-batch"
                    className="text-foreground cursor-pointer text-sm font-normal"
                  >
                    Copy to {targetIds.size} properties
                  </Label>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <ResponsiveModalFooter className="border-border/60 shrink-0 flex-row items-center gap-2 border-t px-5 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-1 justify-start">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                disabled={isCopying}
                onClick={() => {
                  if (step === 3 && lockedTargetPropertyId) {
                    setStep(1);
                    return;
                  }
                  setStep((s) => (s - 1) as StepIndex);
                }}
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
              disabled={isCopying}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                className="min-h-[44px]"
                disabled={!canGoNext || isCopying}
                onClick={() => {
                  if (step === 1 && lockedTargetPropertyId) {
                    if (lockedTargetPropertyId === sourcePropertyId) return;
                    setTargetIds(new Set([lockedTargetPropertyId]));
                    setStep(3);
                    return;
                  }
                  setStep((s) => (s + 1) as StepIndex);
                }}
              >
                Next
              </Button>
            ) : (
              <TierBadgeAnchor feature="copyPropertySettings" className="min-h-[44px]">
                <Button
                  type="button"
                  className="min-h-[44px]"
                  disabled={
                    isCopying ||
                    dryRunLoading ||
                    Boolean(dryRunError) ||
                    !dryRunResult ||
                    (targetIds.size > 10 && !confirmLargeBatch)
                  }
                  onClick={() => void handleCopy()}
                >
                  {isCopying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Copying…
                    </>
                  ) : dryRunLoading ? (
                    'Preview…'
                  ) : (
                    'Copy settings'
                  )}
                </Button>
              </TierBadgeAnchor>
            )}
          </div>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
