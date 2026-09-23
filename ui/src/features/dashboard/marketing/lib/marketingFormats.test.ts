import { describe, expect, it } from 'vitest';

import { marketingFormatMeta, formatPickerSubtitle, templateThumbnailAspectRatio, templateThumbnailMaxHeight, resolveFormatOptionDimensions, CALENDAR_TEMPLATE_THUMBNAIL_ASPECT } from '@/features/dashboard/marketing/lib/marketingFormats';

describe('marketingFormatMeta', () => {

  it('marketingFormatMeta is exported', () => {
    expect(typeof marketingFormatMeta).toBe('function');
  });

});

describe('formatPickerSubtitle', () => {

  it('formatPickerSubtitle is exported', () => {
    expect(typeof formatPickerSubtitle).toBe('function');
  });

});

describe('templateThumbnailAspectRatio', () => {

  it('templateThumbnailAspectRatio is exported', () => {
    expect(typeof templateThumbnailAspectRatio).toBe('function');
  });

});

describe('templateThumbnailMaxHeight', () => {

  it('templateThumbnailMaxHeight is exported', () => {
    expect(typeof templateThumbnailMaxHeight).toBe('function');
  });

});

describe('resolveFormatOptionDimensions', () => {

  it('resolveFormatOptionDimensions is exported', () => {
    expect(typeof resolveFormatOptionDimensions).toBe('function');
  });

});

describe('CALENDAR_TEMPLATE_THUMBNAIL_ASPECT', () => {
  it('is defined', () => {
    expect(CALENDAR_TEMPLATE_THUMBNAIL_ASPECT).toBeDefined();
  });
});
