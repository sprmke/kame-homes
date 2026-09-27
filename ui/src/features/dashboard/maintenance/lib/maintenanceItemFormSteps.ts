export type MaintenanceItemFormDetailsStep = {
  kind: 'details';
  id: 'details';
  label: string;
};

export type MaintenanceItemFormRemindersStep = {
  kind: 'reminders';
  id: 'reminders';
  label: string;
};

export type MaintenanceItemFormPreviewStep = {
  kind: 'preview';
  id: 'preview';
  label: string;
};

export type MaintenanceItemFormStep =
  | MaintenanceItemFormDetailsStep
  | MaintenanceItemFormRemindersStep
  | MaintenanceItemFormPreviewStep;

const DETAILS_STEP: MaintenanceItemFormDetailsStep = {
  kind: 'details',
  id: 'details',
  label: 'Details',
};

const REMINDERS_STEP: MaintenanceItemFormRemindersStep = {
  kind: 'reminders',
  id: 'reminders',
  label: 'Reminders',
};

const PREVIEW_STEP: MaintenanceItemFormPreviewStep = {
  kind: 'preview',
  id: 'preview',
  label: 'Preview',
};

/**
 * Wizard steps for create/edit maintenance reminder.
 * Details → Reminders (repeat + Telegram) → Preview
 */
export function buildMaintenanceItemFormSteps(): MaintenanceItemFormStep[] {
  return [DETAILS_STEP, REMINDERS_STEP, PREVIEW_STEP];
}

export function maintenanceItemFormStepLabels(steps: readonly MaintenanceItemFormStep[]): string[] {
  return steps.map((step) => step.label);
}

export function clampMaintenanceItemFormStepIndex(index: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return Math.min(Math.max(0, index), stepCount - 1);
}

export function findMaintenanceItemFormStepIndex(
  steps: readonly MaintenanceItemFormStep[],
  kind: MaintenanceItemFormStep['kind']
): number {
  return steps.findIndex((step) => step.kind === kind);
}

/** RHF field names to validate before leaving a step. */
export const MAINTENANCE_ITEM_STEP_FIELDS: Record<
  MaintenanceItemFormStep['kind'],
  readonly string[]
> = {
  details: ['label', 'category', 'scheduled_on', 'notes'],
  reminders: [
    'recurrence_interval',
    'recurrence_until',
    'edit_scope',
    'telegram_reminder_enabled',
    'telegram_days_before',
    'telegram_reminder_interval',
    'telegram_message_template',
    'marked_complete',
  ],
  preview: [],
};
