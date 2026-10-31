/**
 * Validates properties.settings JSON patches on update-property.
 */

import { isValidCleaningBufferMinutes } from './cleaningBuffer.ts';
import {
  validateEmailAddress,
  validateFullPersonName,
  validatePhilippineMobilePhone,
} from './fieldValidation.ts';
import {
  normalizeCancellationPolicySettings,
  validateCancellationPolicySettings,
} from './propertyCancellationPolicy.ts';
import { validatePropertyDetailsForResidence } from './propertyResidenceDefaults.ts';

export function validatePropertySettingsPatch(
  incoming: Record<string, unknown>,
  context: { residenceName?: string | null }
): string | null {
  if (typeof incoming.contactName === 'string') {
    const err = validateFullPersonName(incoming.contactName);
    if (err) return err;
  }
  if (typeof incoming.contactPhone === 'string') {
    const err = validatePhilippineMobilePhone(incoming.contactPhone);
    if (err) return err;
  }
  if (typeof incoming.contactEmail === 'string') {
    const err = validateEmailAddress(incoming.contactEmail);
    if (err) return err;
  }

  const hasCapacityField = ['bedrooms', 'bathrooms', 'floors', 'maxAdults', 'maxChildren'].some(
    (key) => incoming[key] !== undefined
  );

  if (hasCapacityField) {
    const err = validatePropertyDetailsForResidence({
      residenceName: context.residenceName,
      bedrooms: incoming.bedrooms,
      bathrooms: incoming.bathrooms,
      floors: incoming.floors,
      maxAdults: incoming.maxAdults,
      maxChildren: incoming.maxChildren,
    });
    if (err) return err;
  }

  if (typeof incoming.description === 'string' && incoming.description.length > 1000) {
    return 'Description is too long (max 1000 characters)';
  }

  if (Array.isArray(incoming.customHouseRules)) {
    for (const entry of incoming.customHouseRules) {
      if (typeof entry !== 'object' || entry === null) continue;
      const name = (entry as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim().length > 50) {
        return 'Custom house rules must be 50 characters or fewer';
      }
    }
  }

  if (Array.isArray(incoming.customAmenities)) {
    for (const entry of incoming.customAmenities) {
      if (typeof entry !== 'object' || entry === null) continue;
      const name = (entry as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim().length > 50) {
        return 'Custom amenities must be 50 characters or fewer';
      }
    }
  }

  if (
    incoming.cleaningBufferMinutes !== undefined &&
    !isValidCleaningBufferMinutes(incoming.cleaningBufferMinutes as number)
  ) {
    return 'Minimum cleaning time is required — between 1 and 6 hours, in 30-minute steps';
  }

  if (incoming.cancellationPolicy !== undefined) {
    const policyErr = validateCancellationPolicySettings(
      normalizeCancellationPolicySettings(incoming.cancellationPolicy)
    );
    if (policyErr) return policyErr;
  }

  if (incoming.inboxPinnedSnippets !== undefined) {
    if (!Array.isArray(incoming.inboxPinnedSnippets)) {
      return 'Pinned snippets must be an array';
    }
    if (incoming.inboxPinnedSnippets.length > 5) {
      return 'Max 5 pinned snippets';
    }
    for (const entry of incoming.inboxPinnedSnippets) {
      if (!entry || typeof entry !== 'object') return 'Invalid pinned snippet';
      const row = entry as Record<string, unknown>;
      const title = String(row.title ?? '').trim();
      const bodyText = String(row.bodyText ?? row.body_text ?? '').trim();
      const id = String(row.id ?? '').trim();
      if (!id || !title || !bodyText) return 'Each pinned snippet needs id, title, and message';
      if (title.length > 80) return 'Pinned snippet title is too long';
      if (bodyText.length > 2000) return 'Pinned snippet message is too long';
    }
  }

  return null;
}
