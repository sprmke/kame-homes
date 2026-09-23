import { describe, expect, it } from 'vitest';

import { canvasFrameBackgroundForFormat, createDefaultCanvasFrame, canvasFrameDefaultsForFormat, computeCalendarLayoutBounds, calendarPreviewWidthForFormat, calendarPreviewDisplayLayout, calendarPreviewLayout, fitZoomLevelForContainer, calendarCanvasAspectRatio, calendarFormatToAspectPreset, normalizeCalendarCanvasFrame, CALENDAR_PREVIEW_ZOOM_LEVELS, CALENDAR_MIN_RELATIVE_ZOOM, CALENDAR_MAX_RELATIVE_ZOOM } from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

describe('canvasFrameBackgroundForFormat', () => {

  it('canvasFrameBackgroundForFormat is exported', () => {
    expect(typeof canvasFrameBackgroundForFormat).toBe('function');
  });

});

describe('createDefaultCanvasFrame', () => {

  it('createDefaultCanvasFrame is exported', () => {
    expect(typeof createDefaultCanvasFrame).toBe('function');
  });

});

describe('canvasFrameDefaultsForFormat', () => {

  it('canvasFrameDefaultsForFormat is exported', () => {
    expect(typeof canvasFrameDefaultsForFormat).toBe('function');
  });

});

describe('computeCalendarLayoutBounds', () => {

  it('computeCalendarLayoutBounds is exported', () => {
    expect(typeof computeCalendarLayoutBounds).toBe('function');
  });

});

describe('calendarPreviewWidthForFormat', () => {

  it('calendarPreviewWidthForFormat is exported', () => {
    expect(typeof calendarPreviewWidthForFormat).toBe('function');
  });

});

describe('calendarPreviewDisplayLayout', () => {

  it('calendarPreviewDisplayLayout is exported', () => {
    expect(typeof calendarPreviewDisplayLayout).toBe('function');
  });

});

describe('calendarPreviewLayout', () => {

  it('calendarPreviewLayout is exported', () => {
    expect(typeof calendarPreviewLayout).toBe('function');
  });

});

describe('fitZoomLevelForContainer', () => {

  it('fitZoomLevelForContainer is exported', () => {
    expect(typeof fitZoomLevelForContainer).toBe('function');
  });

});

describe('calendarCanvasAspectRatio', () => {

  it('calendarCanvasAspectRatio is exported', () => {
    expect(typeof calendarCanvasAspectRatio).toBe('function');
  });

});

describe('calendarFormatToAspectPreset', () => {

  it('calendarFormatToAspectPreset is exported', () => {
    expect(typeof calendarFormatToAspectPreset).toBe('function');
  });

});

describe('normalizeCalendarCanvasFrame', () => {

  it('normalizeCalendarCanvasFrame is exported', () => {
    expect(typeof normalizeCalendarCanvasFrame).toBe('function');
  });

});

describe('CALENDAR_PREVIEW_ZOOM_LEVELS', () => {
  it('is defined', () => {
    expect(CALENDAR_PREVIEW_ZOOM_LEVELS).toBeDefined();
  });
});

describe('CALENDAR_MIN_RELATIVE_ZOOM', () => {
  it('is defined', () => {
    expect(CALENDAR_MIN_RELATIVE_ZOOM).toBeDefined();
  });
});

describe('CALENDAR_MAX_RELATIVE_ZOOM', () => {
  it('is defined', () => {
    expect(CALENDAR_MAX_RELATIVE_ZOOM).toBeDefined();
  });
});
