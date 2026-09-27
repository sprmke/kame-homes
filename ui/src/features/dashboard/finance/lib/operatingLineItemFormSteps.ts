export type OperatingLineItemFormDetailsStep = {
  kind: 'details';
  id: 'details';
  label: string;
};

export type OperatingLineItemFormRepeatStep = {
  kind: 'repeat';
  id: 'repeat';
  label: string;
};

export type OperatingLineItemFormRemindersStep = {
  kind: 'reminders';
  id: 'reminders';
  label: string;
};

export type OperatingLineItemFormPreviewStep = {
  kind: 'preview';
  id: 'preview';
  label: string;
};

export type OperatingLineItemFormStep =
  | OperatingLineItemFormDetailsStep
  | OperatingLineItemFormRepeatStep
  | OperatingLineItemFormRemindersStep
  | OperatingLineItemFormPreviewStep;

const DETAILS_STEP: OperatingLineItemFormDetailsStep = {
  kind: 'details',
  id: 'details',
  label: 'Details',
};

const REPEAT_STEP: OperatingLineItemFormRepeatStep = {
  kind: 'repeat',
  id: 'repeat',
  label: 'Repeat',
};

const REMINDERS_STEP: OperatingLineItemFormRemindersStep = {
  kind: 'reminders',
  id: 'reminders',
  label: 'Reminders',
};

const PREVIEW_STEP: OperatingLineItemFormPreviewStep = {
  kind: 'preview',
  id: 'preview',
  label: 'Preview',
};

/**
 * Wizard steps for create/edit finance transaction.
 * Create + recurring edit: Details → Repeat → Reminders → Preview
 * One-shot edit (no series): Details → Reminders → Preview
 */
export function buildOperatingLineItemFormSteps(input: {
  isEdit: boolean;
  isRecurringEdit: boolean;
}): OperatingLineItemFormStep[] {
  const steps: OperatingLineItemFormStep[] = [DETAILS_STEP];
  if (!input.isEdit || input.isRecurringEdit) {
    steps.push(REPEAT_STEP);
  }
  steps.push(REMINDERS_STEP, PREVIEW_STEP);
  return steps;
}

export function operatingLineItemFormStepLabels(
  steps: readonly OperatingLineItemFormStep[]
): string[] {
  return steps.map((step) => step.label);
}

export function clampOperatingLineItemFormStepIndex(index: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(Math.max(0, index), stepCount - 1);
}

export function findOperatingLineItemFormStepIndex(
  steps: readonly OperatingLineItemFormStep[],
  kind: OperatingLineItemFormStep['kind']
): number {
  return steps.findIndex((step) => step.kind === kind);
}

/** RHF field names to validate before leaving a step. */
export const OPERATING_LINE_ITEM_STEP_FIELDS: Record<
  OperatingLineItemFormStep['kind'],
  readonly string[]
> = {
  details: ['kind', 'label', 'amount', 'category', 'occurred_on', 'notes'],
  repeat: ['recurrence_interval', 'recurrence_until', 'edit_scope'],
  reminders: [
    'telegram_reminder_enabled',
    'telegram_days_before',
    'telegram_reminder_interval',
    'telegram_message_template',
    'marked_paid',
  ],
  preview: [],
};
