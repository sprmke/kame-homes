/** Keep in sync with `supabase/functions/_shared/telegramMaintenance.ts#MAINTENANCE_DEFAULT_REMINDER_TEMPLATE`. */
export const MAINTENANCE_DEFAULT_REMINDER_TEMPLATE =
  '🔧 Maintenance reminder\n\n{{label}}\nDue: {{due_date}} ({{days_until_due}} day(s) left)\nCategory: {{category}}\n\n{{notes}}';

export function maintenanceMessageTemplateForForm(
  stored: string | null | undefined,
  globalDefault = MAINTENANCE_DEFAULT_REMINDER_TEMPLATE
): string {
  const trimmed = stored?.trim();
  return trimmed || globalDefault;
}

export function maintenanceMessageTemplateForApi(
  formValue: string | undefined,
  enabled: boolean,
  globalDefault = MAINTENANCE_DEFAULT_REMINDER_TEMPLATE
): string | null {
  if (!enabled) return null;
  const trimmed = formValue?.trim() ?? '';
  if (!trimmed || trimmed === globalDefault) return null;
  return trimmed;
}
