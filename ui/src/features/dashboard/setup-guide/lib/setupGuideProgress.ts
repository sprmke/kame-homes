import type { OrgSettingsSectionId } from '@/features/dashboard/org/lib/orgSettingsCompletion';
import type { PropertySettingsSectionId } from '@/features/dashboard/org/lib/propertySettingsCompletion';
import type { ParkingSettingsSectionId } from '@/features/dashboard/parking/lib/parkingSettingsCompletion';
import { isSetupGuideRequiredStep } from '@/features/dashboard/setup-guide/lib/setupGuideSteps';
import type {
  SetupGuideCompletionSection,
  SetupGuidePersistedState,
  SetupGuideProgressResult,
  SetupGuideStep,
  SetupGuideStepProgress,
  SetupGuideStepStatus,
} from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

export type SetupGuideCompletionSnapshot = {
  orgIssueSectionIds: readonly OrgSettingsSectionId[];
  propertyIssueSectionIdsById: Readonly<Record<string, readonly PropertySettingsSectionId[]>>;
  parkingIssueSectionIdsById: Readonly<Record<string, readonly ParkingSettingsSectionId[]>>;
  /** Host Tier 1 (base) submitted or approved. */
  hostTier1Submitted: boolean;
  /** Listing ids that still need Tier 1 proof submitted. */
  listingIdsMissingTier1Proof: readonly string[];
  /** Org Recommended (enhanced) submitted or approved. */
  recommendedSubmitted: boolean;
};

export type DeriveSetupGuideProgressInput = {
  steps: SetupGuideStep[];
  completion: SetupGuideCompletionSnapshot;
  persisted: Pick<SetupGuidePersistedState, 'skippedSteps' | 'reviewedSteps' | 'lastStepId'>;
};

function sectionClear(
  section: SetupGuideCompletionSection,
  completion: SetupGuideCompletionSnapshot
): boolean {
  if (section.scope === 'org') {
    return !completion.orgIssueSectionIds.includes(section.sectionId);
  }
  if (section.scope === 'property') {
    const issues = completion.propertyIssueSectionIdsById[section.propertyId] ?? [
      section.sectionId,
    ];
    return !issues.includes(section.sectionId);
  }
  const issues = completion.parkingIssueSectionIdsById[section.parkingId] ?? [section.sectionId];
  return !issues.includes(section.sectionId);
}

function sectionsComplete(
  sections: SetupGuideCompletionSection[],
  completion: SetupGuideCompletionSnapshot
): boolean {
  return sections.every((section) => sectionClear(section, completion));
}

function deriveStepStatus(
  step: SetupGuideStep,
  completion: SetupGuideCompletionSnapshot,
  persisted: Pick<SetupGuidePersistedState, 'skippedSteps' | 'reviewedSteps' | 'lastStepId'>
): SetupGuideStepStatus {
  if (step.kind === 'welcome') {
    const movedPast =
      (persisted.lastStepId != null && persisted.lastStepId !== 'welcome') ||
      persisted.reviewedSteps.includes(step.id);
    return movedPast ? 'complete' : 'incomplete';
  }

  if (step.kind === 'org.done') {
    return 'incomplete';
  }

  if (step.kind === 'org.verification') {
    const ok = completion.hostTier1Submitted && completion.listingIdsMissingTier1Proof.length === 0;
    if (ok) return 'complete';
    if (persisted.skippedSteps.includes(step.id)) return 'skipped';
    return 'incomplete';
  }

  if (step.kind === 'org.recommended') {
    if (completion.recommendedSubmitted) return 'complete';
    if (persisted.skippedSteps.includes(step.id)) return 'skipped';
    return 'incomplete';
  }

  if (step.kind === 'org.team') {
    if (persisted.reviewedSteps.includes(step.id)) return 'complete';
    if (persisted.skippedSteps.includes(step.id)) return 'skipped';
    return 'incomplete';
  }

  if (step.kind === 'property.pricing' || step.kind === 'parking.pricing') {
    if (persisted.reviewedSteps.includes(step.id)) return 'complete';
    if (persisted.skippedSteps.includes(step.id)) return 'skipped';
    return 'incomplete';
  }

  if (step.kind === 'parking.email') {
    if (persisted.reviewedSteps.includes(step.id)) return 'complete';
    if (persisted.skippedSteps.includes(step.id)) return 'skipped';
    return 'incomplete';
  }

  if (step.completionSections.length > 0) {
    if (sectionsComplete(step.completionSections, completion)) return 'complete';
    if (persisted.skippedSteps.includes(step.id)) return 'skipped';
    return 'incomplete';
  }

  if (persisted.reviewedSteps.includes(step.id)) return 'complete';
  if (persisted.skippedSteps.includes(step.id)) return 'skipped';
  return 'incomplete';
}

export function deriveSetupGuideProgress(
  input: DeriveSetupGuideProgressInput
): SetupGuideProgressResult {
  const steps: SetupGuideStepProgress[] = input.steps.map((step) => ({
    step,
    status: deriveStepStatus(step, input.completion, input.persisted),
  }));

  const required = steps.filter((entry) => isSetupGuideRequiredStep(entry.step.requirement));
  const requiredComplete = required.filter((entry) => entry.status === 'complete').length;
  const requiredRemaining = required.length - requiredComplete;

  const doneEntry = steps.find((entry) => entry.step.kind === 'org.done');
  if (doneEntry) {
    doneEntry.status = requiredRemaining === 0 ? 'complete' : 'incomplete';
  }

  const firstIncompleteRequired = steps.find(
    (entry) => isSetupGuideRequiredStep(entry.step.requirement) && entry.status !== 'complete'
  );
  const firstIncompleteAny = steps.find((entry) => entry.status === 'incomplete');
  const resumeStepId =
    firstIncompleteRequired?.step.id ??
    firstIncompleteAny?.step.id ??
    steps[steps.length - 1]?.step.id ??
    null;

  return {
    steps,
    requiredRemaining,
    requiredTotal: required.length,
    requiredComplete,
    resumeStepId,
  };
}

/** True when the launcher should hide (all Required steps complete). */
export function setupGuideRequiredComplete(progress: SetupGuideProgressResult): boolean {
  return progress.requiredRemaining === 0;
}

function isSetupGuideStepSettled(status: SetupGuideStepStatus): boolean {
  return status === 'complete' || status === 'skipped' || status === 'not-applicable';
}

/** First step that still needs action. Equals `entries.length` when every step is settled. */
export function setupGuideFrontierIndex(entries: readonly SetupGuideStepProgress[]): number {
  const index = entries.findIndex((entry) => !isSetupGuideStepSettled(entry.status));
  return index === -1 ? entries.length : index;
}

/** A step can be opened when every earlier step is complete or skipped. */
export function isSetupGuideStepReachable(
  entries: readonly SetupGuideStepProgress[],
  stepId: string
): boolean {
  const index = entries.findIndex((entry) => entry.step.id === stepId);
  if (index < 0) return false;
  return index <= setupGuideFrontierIndex(entries);
}
