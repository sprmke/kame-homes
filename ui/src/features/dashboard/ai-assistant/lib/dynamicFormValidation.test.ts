import { describe, expect, it } from 'vitest';

import { validateDynamicFormField, validateDynamicFormValues, isDynamicFormValid } from '@/features/dashboard/ai-assistant/lib/dynamicFormValidation';

describe('validateDynamicFormField', () => {

  it('validateDynamicFormField is exported', () => {
    expect(typeof validateDynamicFormField).toBe('function');
  });

});

describe('validateDynamicFormValues', () => {

  it('validateDynamicFormValues is exported', () => {
    expect(typeof validateDynamicFormValues).toBe('function');
  });

});

describe('isDynamicFormValid', () => {

  it('isDynamicFormValid is exported', () => {
    expect(typeof isDynamicFormValid).toBe('function');
  });

});
