import type { DynamicFormField } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

import {
  validateEmailAddress,
  validatePhilippineMobilePhone,
} from '@/lib/validation/fieldValidation';

/**
 * Validates one `dynamic_form` field value against the same rules the rest of the app
 * uses (`@/lib/validation/fieldValidation`) so error copy matches everywhere.
 */
export function validateDynamicFormField(field: DynamicFormField, rawValue: string): string | null {
  if (field.fieldType === 'checkbox') {
    return field.required && rawValue !== 'true' ? 'Required' : null;
  }

  const value = rawValue.trim();
  if (!value) {
    return field.required ? `${field.label} is required` : null;
  }

  switch (field.fieldType) {
    case 'email':
      return validateEmailAddress(value);
    case 'tel':
      return validatePhilippineMobilePhone(value);
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) return 'Enter a valid number';
      if (field.min != null && num < field.min) return `Must be at least ${field.min}`;
      if (field.max != null && num > field.max) return `Must be ${field.max} or less`;
      return null;
    }
    case 'text':
    case 'textarea':
      if (field.maxLength != null && value.length > field.maxLength) {
        return `${field.label} must be ${field.maxLength} characters or fewer`;
      }
      return null;
    default:
      return null;
  }
}

export function validateDynamicFormValues(
  fields: DynamicFormField[],
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const message = validateDynamicFormField(field, values[field.key] ?? '');
    if (message) errors[field.key] = message;
  }
  return errors;
}

export function isDynamicFormValid(
  fields: DynamicFormField[],
  values: Record<string, string>
): boolean {
  return fields.every((field) => !validateDynamicFormField(field, values[field.key] ?? ''));
}
