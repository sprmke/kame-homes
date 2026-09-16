import {
  assertBookingBelongsToProperty,
  requireExplicitPropertyId,
  resolvePublicPropertyId,
} from './propertyScope.ts';

Deno.test('requireExplicitPropertyId returns trimmed id', () => {
  const id = requireExplicitPropertyId('  prop-1  ');
  if (id !== 'prop-1') throw new Error(`expected prop-1, got ${id}`);
});

Deno.test('requireExplicitPropertyId throws 400 when missing', async () => {
  try {
    requireExplicitPropertyId('');
    throw new Error('expected throw');
  } catch (error) {
    if (!(error instanceof Response) || error.status !== 400) {
      throw new Error('expected 400 Response');
    }
    const body = (await error.json()) as { error?: string };
    if (body.error !== 'property_id is required') {
      throw new Error(`unexpected body: ${JSON.stringify(body)}`);
    }
  }
});

Deno.test('assertBookingBelongsToProperty rejects parking-scoped and cross-property rows', () => {
  assertBookingBelongsToProperty('prop-1', 'prop-1');

  for (const bookingPropertyId of [null, 'prop-2']) {
    try {
      assertBookingBelongsToProperty(bookingPropertyId, 'prop-1');
      throw new Error('expected throw');
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== 'Booking does not belong to this property'
      ) {
        throw error;
      }
    }
  }
});

Deno.test('resolvePublicPropertyId throws 400 when property is omitted', async () => {
  try {
    await resolvePublicPropertyId(new URL('https://example.test/get-form'));
    throw new Error('expected throw');
  } catch (error) {
    if (!(error instanceof Response) || error.status !== 400) {
      throw new Error('expected 400 Response');
    }
    const body = (await error.json()) as { error?: string };
    if (body.error !== 'property is required') {
      throw new Error(`unexpected body: ${JSON.stringify(body)}`);
    }
  }
});
