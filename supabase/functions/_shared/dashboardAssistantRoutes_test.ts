import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  ASSISTANT_ROUTE_KEYS,
  ASSISTANT_ROUTES,
  buildAssistantRouteHref,
  isAssistantRouteKey,
} from './dashboardAssistantRoutes.ts';

Deno.test('route keys are prefixed with their scope', () => {
  for (const key of ASSISTANT_ROUTE_KEYS) {
    assertEquals(key.split('.')[0], ASSISTANT_ROUTES[key].scope);
  }
});

Deno.test('buildAssistantRouteHref builds scoped paths', () => {
  assertEquals(buildAssistantRouteHref('org.team', { orgSlug: 'acme' }), '/org/acme/team');
  assertEquals(
    buildAssistantRouteHref('property.dashboard', { orgSlug: 'acme', propertySlug: 'loft' }),
    '/org/acme/property/loft'
  );
  assertEquals(
    buildAssistantRouteHref('parking.finance', { orgSlug: 'acme', parkingSlug: 'p1' }),
    '/org/acme/parking/p1/finance'
  );
  assertEquals(
    buildAssistantRouteHref('property.booking', {
      orgSlug: 'acme',
      propertySlug: 'loft',
      bookingId: '8f0c2a8e-1111-4c4c-9d9d-000000000001',
    }),
    '/org/acme/property/loft/bookings/8f0c2a8e-1111-4c4c-9d9d-000000000001'
  );
});

Deno.test('buildAssistantRouteHref only passes allowlisted, safe query values', () => {
  assertEquals(
    buildAssistantRouteHref('property.bookings', {
      orgSlug: 'acme',
      propertySlug: 'loft',
      query: { status: 'PENDING_REVIEW', evil: 'x', q: '<script>' },
    }),
    '/org/acme/property/loft/bookings?status=PENDING_REVIEW'
  );
});

Deno.test('buildAssistantRouteHref refuses missing scope or bad ids', () => {
  assertEquals(buildAssistantRouteHref('property.finance', { orgSlug: 'acme' }), null);
  assertEquals(
    buildAssistantRouteHref('property.booking', {
      orgSlug: 'acme',
      propertySlug: 'loft',
      bookingId: '../../admin',
    }),
    null
  );
  assertEquals(isAssistantRouteKey('property.finance'), true);
  assertEquals(isAssistantRouteKey('admin.orgs'), false);
  assertEquals(isAssistantRouteKey('toString'), false);
});
