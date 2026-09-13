import { useMemo, useState } from 'react';

import { Building2, Car, Check, ChevronLeft, ChevronRight } from 'lucide-react';

import { useSetupGuide } from '@/features/dashboard/setup-guide/components/setupGuideContext';
import {
  SetupGuideSaveProvider,
  useSetupGuideSaveBridge,
} from '@/features/dashboard/setup-guide/components/SetupGuideSaveContext';
import { SetupGuideStepBody } from '@/features/dashboard/setup-guide/components/SetupGuideStepBody';
import { setupGuideStepShortTitle } from '@/features/dashboard/setup-guide/lib/setupGuideSteps';
import type {
  SetupGuideStep,
  SetupGuideStepProgress,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

import { ParkingFlowStepper } from '@/components/parking/ParkingFlowStepper';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

function groupLabel(step: SetupGuideStep): string {
  switch (step.group.type) {
    case 'org-start':
      return 'Organization';
    case 'org-trust':
      return 'Verification';
    case 'org-finish':
      return 'Finish';
    case 'property':
    case 'parking':
      return 'Listings';
    default:
      return 'Setup';
  }
}

function groupKey(step: SetupGuideStep): string {
  switch (step.group.type) {
    case 'property':
      return `property:${step.group.propertyId}`;
    case 'parking':
      return `parking:${step.group.parkingId}`;
    default:
      return step.group.type;
  }
}

function listingName(step: SetupGuideStep): string {
  if (step.group.type === 'property') return step.group.propertyName;
  if (step.group.type === 'parking') return step.group.parkingName;
  return groupLabel(step);
}

function isListingGroup(key: string): boolean {
  return key.startsWith('property:') || key.startsWith('parking:');
}

type StepperGroup = {
  key: string;
  label: string;
  entries: SetupGuideStepProgress[];
  listing: boolean;
};

function buildStepperGroups(entries: SetupGuideStepProgress[]): StepperGroup[] {
  const groups: StepperGroup[] = [];
  for (const entry of entries) {
    const key = groupKey(entry.step);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({
        key,
        label: isListingGroup(key) ? listingName(entry.step) : groupLabel(entry.step),
        entries: [entry],
        listing: isListingGroup(key),
      });
    }
  }
  return groups;
}

function firstIncompleteStepId(entries: SetupGuideStepProgress[]): string {
  const incomplete = entries.find(
    (entry) => entry.status !== 'complete' && entry.step.requirement === 'required'
  );
  if (incomplete) return incomplete.step.id;
  const anyOpen = entries.find((entry) => entry.status !== 'complete');
  return anyOpen?.step.id ?? entries[0]?.step.id ?? '';
}

function showFooterSkip(kind: SetupGuideStep['kind'] | undefined): boolean {
  return kind === 'org.verification' || kind === 'org.recommended' || kind === 'org.team';
}

function sectionHeading(type: SetupGuideStep['group']['type']): string | null {
  switch (type) {
    case 'org-start':
      return 'Organization';
    case 'org-trust':
      return 'Verification';
    case 'org-finish':
      return 'Finish';
    default:
      return null;
  }
}

export function SetupGuideOverlay() {
  const { open, closeGuide, steps, progress, activeStepId, goToStep, goNext, goBack, skipCurrent } =
    useSetupGuide();
  const { registerSave, runSave, hasSave } = useSetupGuideSaveBridge();
  const [saving, setSaving] = useState(false);

  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeStepId)
  );
  const activeStep = steps[activeIndex] ?? steps[0];
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= steps.length - 1;
  const cinematic = activeStep?.kind === 'welcome' || activeStep?.kind === 'org.done';
  const listingActive =
    activeStep?.group.type === 'property' || activeStep?.group.type === 'parking';
  const activeProgress = progress.steps.find((entry) => entry.step.id === activeStep?.id);
  const footerSkip = showFooterSkip(activeStep?.kind);
  const optionalOpen =
    footerSkip && activeProgress?.status !== 'complete' && activeStep?.kind !== 'org.team';

  const listingEntries = useMemo(() => {
    if (!listingActive || !activeStep) return [];
    const key = groupKey(activeStep);
    return progress.steps.filter((entry) => groupKey(entry.step) === key);
  }, [activeStep, listingActive, progress.steps]);

  const handlePrimary = async () => {
    if (isLast && !hasSave) {
      closeGuide();
      return;
    }
    if (!hasSave) {
      if (optionalOpen) {
        skipCurrent();
        return;
      }
      if (!isLast) goNext();
      else closeGuide();
      return;
    }
    setSaving(true);
    try {
      const ok = await runSave();
      if (ok && !isLast) goNext();
      if (ok && isLast) closeGuide();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next) closeGuide({ dismiss: true });
      }}
    >
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={false}
        className={cn(
          'flex max-h-[min(92dvh,860px)] w-[min(100vw-1rem,72rem)] flex-col gap-0 overflow-hidden p-0 sm:p-0',
          'sm:max-w-[min(100vw-1.5rem,72rem)] lg:max-w-[min(100vw-2rem,76rem)]'
        )}
      >
        <ResponsiveModalDescription className="sr-only">
          Guided setup for your organization and listings.
        </ResponsiveModalDescription>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <SetupGuideNav
            entries={progress.steps}
            activeStepId={activeStep?.id ?? null}
            onSelect={goToStep}
          />

          <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {listingActive && listingEntries.length > 1 ? (
              <header className="border-border bg-background shrink-0 border-b px-3 py-3 sm:px-5">
                <SetupGuideListingStepper
                  entries={listingEntries}
                  activeStepId={activeStep?.id ?? null}
                  onSelect={goToStep}
                />
              </header>
            ) : cinematic ? (
              <ResponsiveModalDescription className="sr-only">
                {activeStep?.title ?? 'Setup'}
              </ResponsiveModalDescription>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
              <div key={activeStep?.id ?? 'setup'} className="motion-safe:animate-setup-guide-pane">
                <SetupGuideSaveProvider registerSave={registerSave}>
                  <SetupGuideStepBody step={activeStep} />
                </SetupGuideSaveProvider>
              </div>
            </div>

            <ResponsiveModalFooter className="border-border bg-background shrink-0 gap-2 border-t px-3 py-2.5 sm:px-4">
              {footerSkip && !isLast ? (
                <Button type="button" variant="ghost" className="min-h-11" onClick={skipCurrent}>
                  Skip
                </Button>
              ) : null}
              <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={isFirst}
                  onClick={goBack}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Back
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={() => void handlePrimary()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : isLast ? 'Finish' : hasSave ? 'Save & continue' : 'Next'}
                  {!saving && !isLast ? <ChevronRight className="size-4" aria-hidden /> : null}
                </Button>
              </div>
            </ResponsiveModalFooter>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function isSkippableStep(requirement: SetupGuideStep['requirement']): boolean {
  return requirement === 'optional' || requirement === 'recommended';
}

function SetupGuideNav({
  entries,
  activeStepId,
  onSelect,
}: {
  entries: SetupGuideStepProgress[];
  activeStepId: string | null;
  onSelect: (stepId: string) => void;
}) {
  const navEntries = useMemo(
    () => entries.filter((entry) => entry.step.kind !== 'welcome'),
    [entries]
  );
  const groups = useMemo(() => buildStepperGroups(navEntries), [navEntries]);
  const listingGroups = useMemo(() => groups.filter((group) => group.listing), [groups]);
  const activeGroupKey = useMemo(() => {
    const active = navEntries.find((entry) => entry.step.id === activeStepId);
    return active ? groupKey(active.step) : null;
  }, [activeStepId, navEntries]);
  const firstListingKey = listingGroups[0]?.key ?? null;

  const openListing = (group: StepperGroup) => {
    const alreadyInGroup = group.entries.some((entry) => entry.step.id === activeStepId);
    if (alreadyInGroup) return;
    const target = firstIncompleteStepId(group.entries);
    if (target) onSelect(target);
  };

  return (
    <nav
      aria-label="Setup steps"
      className={cn(
        'border-border bg-muted/30 shrink-0 border-b',
        'max-h-44 overflow-x-auto overflow-y-hidden px-2 py-2.5',
        'lg:max-h-none lg:w-[18.5rem] lg:shrink-0 lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r lg:px-0 lg:py-0'
      )}
    >
      <ol className="flex gap-1.5 lg:flex-col lg:gap-0 lg:px-2.5 lg:py-3">
        {groups.map((group, groupIndex) => {
          const requiredEntries = group.entries.filter(
            (entry) => entry.step.requirement === 'required'
          );
          const doneCount = group.entries.filter((entry) => entry.status === 'complete').length;
          const requiredDone = requiredEntries.filter(
            (entry) => entry.status === 'complete'
          ).length;
          const allDone =
            requiredEntries.length > 0
              ? requiredDone === requiredEntries.length
              : doneCount === group.entries.length;
          const heading = !group.listing ? sectionHeading(group.entries[0]?.step.group.type) : null;
          const showListingsLabel = group.listing && group.key === firstListingKey;
          const listingActive = group.listing && group.key === activeGroupKey;
          const listingKind = group.entries[0]?.step.group.type;
          const ListingIcon = listingKind === 'parking' ? Car : Building2;

          return (
            <li key={group.key} className="contents">
              {heading ? (
                <div
                  className={cn(
                    'text-muted-foreground mt-1 hidden items-center justify-between gap-2 px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider lg:flex',
                    groupIndex > 0 && 'border-border border-t'
                  )}
                >
                  <span>{heading}</span>
                  <span className="font-normal normal-case tabular-nums tracking-normal">
                    {doneCount}/{group.entries.length}
                  </span>
                </div>
              ) : null}

              {showListingsLabel ? (
                <div className="border-border text-muted-foreground mt-1 hidden items-center justify-between gap-2 border-t px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider lg:flex">
                  <span>
                    Listings
                    <span className="ml-1 font-normal normal-case tracking-normal">
                      ({listingGroups.length})
                    </span>
                  </span>
                </div>
              ) : null}

              {group.listing ? (
                <button
                  type="button"
                  onClick={() => openListing(group)}
                  className={cn(
                    'focus-visible:ring-ring relative flex min-h-11 min-w-[10.5rem] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                    'lg:w-full lg:min-w-0',
                    listingActive
                      ? 'bg-primary/10 text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
                  )}
                  aria-current={listingActive ? 'step' : undefined}
                >
                  {listingActive ? (
                    <span
                      className="bg-primary absolute inset-y-2 left-0 hidden w-0.5 rounded-full lg:block"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md',
                      listingActive
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                    aria-hidden
                  >
                    <ListingIcon className="size-3.5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" title={group.label}>
                      {group.label}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[10px] tabular-nums">
                      {listingKind === 'parking' ? 'Parking' : 'Property'} · {doneCount}/
                      {group.entries.length}
                    </span>
                  </span>
                  <NavMark done={allDone} active={listingActive} />
                </button>
              ) : (
                group.entries.map((entry) => {
                  const active = entry.step.id === activeStepId;
                  const done = entry.status === 'complete';
                  const skipped = entry.status === 'skipped';
                  const skippable = isSkippableStep(entry.step.requirement);
                  return (
                    <button
                      key={entry.step.id}
                      type="button"
                      onClick={() => onSelect(entry.step.id)}
                      className={cn(
                        'focus-visible:ring-ring relative flex min-h-10 min-w-[9.5rem] items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        'lg:w-full lg:min-w-0',
                        active
                          ? 'bg-primary/10 text-foreground font-medium shadow-sm'
                          : 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
                      )}
                      aria-current={active ? 'step' : undefined}
                    >
                      {active ? (
                        <span
                          className="bg-primary absolute inset-y-2 left-0 hidden w-0.5 rounded-full lg:block"
                          aria-hidden
                        />
                      ) : null}
                      <NavMark done={done} active={active} skipped={skipped} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{entry.step.title}</span>
                        {skippable ? (
                          <span className="text-muted-foreground/90 mt-0.5 block text-[10px]">
                            {skipped ? 'Skipped' : 'Optional'}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function NavMark({
  done,
  active,
  skipped = false,
}: {
  done: boolean;
  active: boolean;
  skipped?: boolean;
}) {
  return (
    <span
      className={cn(
        'flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border text-[9px]',
        done
          ? 'border-primary bg-primary text-primary-foreground'
          : skipped
            ? 'border-border bg-muted text-muted-foreground'
            : active
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border/80'
      )}
      aria-hidden
    >
      {done ? (
        <Check className="motion-safe:animate-setup-guide-check-in size-2.5" strokeWidth={3} />
      ) : active ? (
        <span className="bg-primary size-1.5 rounded-full" />
      ) : null}
    </span>
  );
}

function SetupGuideListingStepper({
  entries,
  activeStepId,
  onSelect,
}: {
  entries: SetupGuideStepProgress[];
  activeStepId: string | null;
  onSelect: (stepId: string) => void;
}) {
  const activeIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.step.id === activeStepId)
  );

  return (
    <ParkingFlowStepper
      steps={entries.map((entry) => ({
        id: entry.step.id,
        label: setupGuideStepShortTitle(entry.step.kind),
      }))}
      activeIndex={activeIndex}
      showAllLabels={false}
      onStepSelect={(index) => {
        const target = entries[index];
        if (target) onSelect(target.step.id);
      }}
    />
  );
}
