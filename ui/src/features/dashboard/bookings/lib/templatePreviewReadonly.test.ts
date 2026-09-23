import { describe, expect, it } from 'vitest';

import { isTemplatePreviewInteractiveTarget, blockTemplatePreviewAction, blockTemplatePreviewKeydown, attachTemplatePreviewActionBlocker } from '@/features/dashboard/bookings/lib/templatePreviewReadonly';

describe('isTemplatePreviewInteractiveTarget', () => {

  it('isTemplatePreviewInteractiveTarget is exported', () => {
    expect(typeof isTemplatePreviewInteractiveTarget).toBe('function');
  });

});

describe('blockTemplatePreviewAction', () => {

  it('blockTemplatePreviewAction is exported', () => {
    expect(typeof blockTemplatePreviewAction).toBe('function');
  });

});

describe('blockTemplatePreviewKeydown', () => {

  it('blockTemplatePreviewKeydown is exported', () => {
    expect(typeof blockTemplatePreviewKeydown).toBe('function');
  });

});

describe('attachTemplatePreviewActionBlocker', () => {

  it('attachTemplatePreviewActionBlocker is exported', () => {
    expect(typeof attachTemplatePreviewActionBlocker).toBe('function');
  });

});
