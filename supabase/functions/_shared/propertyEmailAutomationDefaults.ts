/**
 * Per-residence email automation labels, placeholders, and defaults.
 * Keep in sync with ui/src/features/dashboard/org/lib/propertyEmailAutomationDefaults.ts
 */

import { DEFAULT_RESIDENCE_NAME } from './propertyResidenceDefaults.ts';

export const AZURE_PMO_EMAIL = 'stlmonaco.theresortresidences@azurenorth.com.ph';

export type EmailAutomationFieldCopy = {
  propertyEmailLabel: string;
  propertyEmailHint: string;
  propertyEmailPlaceholder: string;
  /** Used when development `pmoEmail` and legacy `app_settings.email_to` are empty. */
  defaultPmoEmail: string;
};

const GENERIC_COPY: EmailAutomationFieldCopy = {
  propertyEmailLabel: 'Team email',
  propertyEmailHint:
    'Ops inbox for new booking alerts and CC on GAF/pet requests. Also used as Reply-To on most guest emails.',
  propertyEmailPlaceholder: 'team@yourcompany.com',
  defaultPmoEmail: '',
};

const AZURE_NORTH_COPY: EmailAutomationFieldCopy = {
  propertyEmailLabel: 'Property email',
  propertyEmailHint:
    'Ops inbox for new booking alerts and CC on GAF/pet requests. Also used as Reply-To on most guest emails.',
  propertyEmailPlaceholder: 'property@azurenorth.com.ph',
  defaultPmoEmail: AZURE_PMO_EMAIL,
};

const COPY_BY_RESIDENCE: Record<string, EmailAutomationFieldCopy> = {
  [DEFAULT_RESIDENCE_NAME]: AZURE_NORTH_COPY,
};

export function getEmailAutomationDefaults(residenceName: string): EmailAutomationFieldCopy {
  const normalized = residenceName.trim();
  return COPY_BY_RESIDENCE[normalized] ?? GENERIC_COPY;
}
