import { describe, expect, it } from 'vitest';

import {
  SETTINGS_SUMMARY_MAX_CHARS,
  SETTINGS_SUMMARY_MAX_ITEMS,
  summarizeSettingsLabels,
} from '@/features/dashboard/org/lib/propertySettingsSummaryLabels';

describe('summarizeSettingsLabels', () => {
  it('names every item when the list is short', () => {
    expect(summarizeSettingsLabels(['WiFi', 'Air Conditioning'])).toEqual({
      shown: ['WiFi', 'Air Conditioning'],
      hiddenCount: 0,
    });
  });

  it('caps at the item limit and counts the rest', () => {
    const labels = ['WiFi', 'TV', 'Pool', 'Gym', 'Balcony', 'Parking'];
    expect(summarizeSettingsLabels(labels)).toEqual({
      shown: ['WiFi', 'TV', 'Pool'],
      hiddenCount: 3,
    });
  });

  it('collapses on the character budget before the item limit', () => {
    const labels = ['Extra Pillows & Blankets', 'Smart Lock/Keyless Entry', 'Fire Extinguisher'];
    expect(summarizeSettingsLabels(labels)).toEqual({
      shown: ['Extra Pillows & Blankets'],
      hiddenCount: 2,
    });
  });

  it('fits two long labels within the budget and drops the third', () => {
    const labels = ['Carbon Monoxide Alarm', 'Smart Lock/Keyless Entry', 'Fire Extinguisher'];
    expect(summarizeSettingsLabels(labels)).toEqual({
      shown: ['Carbon Monoxide Alarm', 'Smart Lock/Keyless Entry'],
      hiddenCount: 1,
    });
  });

  it('keeps check-in and check-out together for house rules', () => {
    expect(summarizeSettingsLabels(['Check-in: After 14:00', 'Checkout: Before 12:00'])).toEqual({
      shown: ['Check-in: After 14:00', 'Checkout: Before 12:00'],
      hiddenCount: 0,
    });
  });

  it('keeps the first label even when it alone exceeds the budget', () => {
    const long = 'x'.repeat(SETTINGS_SUMMARY_MAX_CHARS + 20);
    expect(summarizeSettingsLabels([long, 'WiFi'])).toEqual({
      shown: [long],
      hiddenCount: 1,
    });
  });

  it('counts a second label when both fit the budget', () => {
    expect(summarizeSettingsLabels(['WiFi', 'Pool', 'Gym'])).toEqual({
      shown: ['WiFi', 'Pool', 'Gym'],
      hiddenCount: 0,
    });
  });

  it('returns an empty summary for no selection', () => {
    expect(summarizeSettingsLabels([])).toEqual({ shown: [], hiddenCount: 0 });
  });

  it('drops blank and whitespace-only labels', () => {
    expect(summarizeSettingsLabels(['  ', 'WiFi', ''])).toEqual({
      shown: ['WiFi'],
      hiddenCount: 0,
    });
  });

  it('honours custom limits', () => {
    expect(
      summarizeSettingsLabels(['WiFi', 'Pool', 'Gym'], { maxItems: 1, maxChars: 999 })
    ).toEqual({ shown: ['WiFi'], hiddenCount: 2 });
  });

  it('exposes the documented defaults', () => {
    expect(SETTINGS_SUMMARY_MAX_ITEMS).toBe(3);
    expect(SETTINGS_SUMMARY_MAX_CHARS).toBe(48);
  });
});
