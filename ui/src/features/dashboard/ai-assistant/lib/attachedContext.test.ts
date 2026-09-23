import { describe, expect, it } from 'vitest';

import { isAttachedContextType, attachedContextKey, upsertAttachedContext, removeAttachedContext, firstAttachedOfType, ATTACHED_CONTEXT_TYPES, ATTACHED_CONTEXT_MAX } from '@/features/dashboard/ai-assistant/lib/attachedContext';

describe('isAttachedContextType', () => {

  it('isAttachedContextType is exported', () => {
    expect(typeof isAttachedContextType).toBe('function');
  });

});

describe('attachedContextKey', () => {

  it('attachedContextKey is exported', () => {
    expect(typeof attachedContextKey).toBe('function');
  });

});

describe('upsertAttachedContext', () => {

  it('upsertAttachedContext is exported', () => {
    expect(typeof upsertAttachedContext).toBe('function');
  });

});

describe('removeAttachedContext', () => {

  it('removeAttachedContext is exported', () => {
    expect(typeof removeAttachedContext).toBe('function');
  });

});

describe('firstAttachedOfType', () => {

  it('firstAttachedOfType is exported', () => {
    expect(typeof firstAttachedOfType).toBe('function');
  });

});

describe('ATTACHED_CONTEXT_TYPES', () => {
  it('is defined', () => {
    expect(ATTACHED_CONTEXT_TYPES).toBeDefined();
  });
});

describe('ATTACHED_CONTEXT_MAX', () => {
  it('is defined', () => {
    expect(ATTACHED_CONTEXT_MAX).toBeDefined();
  });
});
