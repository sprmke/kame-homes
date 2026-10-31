export function resolveOrgSettingsFieldError(
  fieldId: string,
  fieldErrors: Record<string, string>,
  interactedFields: Readonly<Record<string, boolean>>,
  showAllErrors: boolean
): string | null {
  const error = fieldErrors[fieldId];
  if (!error) return null;
  if (showAllErrors || interactedFields[fieldId]) return error;
  return null;
}
