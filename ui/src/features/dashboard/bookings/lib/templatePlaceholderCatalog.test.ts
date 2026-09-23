import { describe, expect, it } from 'vitest';

import { isBlockLevelPropertyPlaceholder, placeholderTokenForKey, propertyPlaceholderKeysForTemplate, propertyPlaceholderLinesForTemplate, telegramPlaceholderLinesByTab, PROPERTY_BLOCK_PLACEHOLDER_KEYS, TELEGRAM_FINANCE_PLACEHOLDER_KEYS, TELEGRAM_MAINTENANCE_PLACEHOLDER_KEYS, TELEGRAM_CHAT_PLACEHOLDER_KEYS } from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

describe('isBlockLevelPropertyPlaceholder', () => {

  it('isBlockLevelPropertyPlaceholder is exported', () => {
    expect(typeof isBlockLevelPropertyPlaceholder).toBe('function');
  });

});

describe('placeholderTokenForKey', () => {

  it('placeholderTokenForKey is exported', () => {
    expect(typeof placeholderTokenForKey).toBe('function');
  });

});

describe('propertyPlaceholderKeysForTemplate', () => {

  it('propertyPlaceholderKeysForTemplate is exported', () => {
    expect(typeof propertyPlaceholderKeysForTemplate).toBe('function');
  });

});

describe('propertyPlaceholderLinesForTemplate', () => {

  it('propertyPlaceholderLinesForTemplate is exported', () => {
    expect(typeof propertyPlaceholderLinesForTemplate).toBe('function');
  });

});

describe('telegramPlaceholderLinesByTab', () => {

  it('telegramPlaceholderLinesByTab is exported', () => {
    expect(typeof telegramPlaceholderLinesByTab).toBe('function');
  });

});

describe('PROPERTY_BLOCK_PLACEHOLDER_KEYS', () => {
  it('is defined', () => {
    expect(PROPERTY_BLOCK_PLACEHOLDER_KEYS).toBeDefined();
  });
});

describe('TELEGRAM_FINANCE_PLACEHOLDER_KEYS', () => {
  it('is defined', () => {
    expect(TELEGRAM_FINANCE_PLACEHOLDER_KEYS).toBeDefined();
  });
});

describe('TELEGRAM_MAINTENANCE_PLACEHOLDER_KEYS', () => {
  it('is defined', () => {
    expect(TELEGRAM_MAINTENANCE_PLACEHOLDER_KEYS).toBeDefined();
  });
});

describe('TELEGRAM_CHAT_PLACEHOLDER_KEYS', () => {
  it('is defined', () => {
    expect(TELEGRAM_CHAT_PLACEHOLDER_KEYS).toBeDefined();
  });
});
