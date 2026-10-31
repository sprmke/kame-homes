import { describe, expect, it } from 'vitest';

import {
  assistantPageContextKey,
  buildAssistantPageContext,
} from '@/features/dashboard/ai-assistant/lib/assistantPageContext';

describe('buildAssistantPageContext', () => {
  it('sends parkingId on parking routes', () => {
    expect(
      buildAssistantPageContext({ propertyId: null, parkingId: 'pk-1', bookingId: 'b-1' })
    ).toEqual({ propertyId: null, parkingId: 'pk-1', bookingId: 'b-1' });
  });

  it('normalizes missing values to null', () => {
    expect(
      buildAssistantPageContext({ propertyId: 'p-1', parkingId: undefined, bookingId: undefined })
    ).toEqual({ propertyId: 'p-1', parkingId: null, bookingId: null });
  });

  it('keys differ per scope', () => {
    const property = buildAssistantPageContext({
      propertyId: 'x',
      parkingId: null,
      bookingId: null,
    });
    const parking = buildAssistantPageContext({
      propertyId: null,
      parkingId: 'x',
      bookingId: null,
    });
    expect(assistantPageContextKey(property)).not.toBe(assistantPageContextKey(parking));
  });
});
