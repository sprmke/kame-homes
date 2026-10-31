/**
 * list-properties — GET properties for an org (owner sees all; members see assigned only).
 * Query: ?orgId=uuid OR ?orgSlug=slug
 */

import { createServiceClient, serializeProperty, verifyOrgListAccess } from '../_shared/orgAuth.ts';
import {
  computePropertyListStatsByPropertyId,
  propertyListStatsOrEmpty,
} from '../_shared/propertyListStats.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-properties', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() ?? '';
  const orgSlug = url.searchParams.get('orgSlug')?.trim() ?? '';

  if (!orgId && !orgSlug) {
    return jsonError(req, 'orgId or orgSlug is required');
  }

  const { user, org, canListAllProperties } = await verifyOrgListAccess(
    req,
    orgId || undefined,
    orgSlug || undefined
  );

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', org.id)
    .order('name', { ascending: true });

  if (error) {
    console.error('[list-properties]', error.message);
    throw new Error('Failed to list properties');
  }

  let properties = data ?? [];

  if (!canListAllProperties) {
    const { data: memberRows, error: memberError } = await supabase
      .from('property_members')
      .select('property_id')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (memberError) {
      console.error('[list-properties]', memberError.message);
      throw new Error('Failed to list properties');
    }

    const { data: planLimitedRows, error: planLimitedError } = await supabase
      .from('property_members')
      .select('property_id')
      .eq('user_id', user.id)
      .eq('status', 'inactive')
      .eq('plan_limited', true);

    if (planLimitedError) {
      console.error('[list-properties]', planLimitedError.message);
      throw new Error('Failed to list properties');
    }

    const allowed = new Set([
      ...(memberRows ?? []).map((row) => row.property_id as string),
      ...(planLimitedRows ?? []).map((row) => row.property_id as string),
    ]);
    properties = properties.filter((row) => allowed.has(row.id as string));
  }

  const propertyIds = properties.map((row) => row.id as string);
  let statsByPropertyId = new Map<string, ReturnType<typeof propertyListStatsOrEmpty>>();

  if (propertyIds.length > 0) {
    // Owner/admin scope can span hundreds of properties — filter by organization_id
    // through an inner-joined embed instead of an `id.in.(...)` list, which blows
    // past request URI length limits at that scale. Member scope stays a plain
    // `.in()` since a member's assigned-property set is always small.
    const bookingsQuery = canListAllProperties
      ? supabase
          .from('guest_submissions')
          .select(
            'property_id, status, check_in_date, check_out_date, number_of_nights, booking_rate, number_of_adults, number_of_children, properties!inner(organization_id)'
          )
          .eq('properties.organization_id', org.id)
      : supabase
          .from('guest_submissions')
          .select(
            'property_id, status, check_in_date, check_out_date, number_of_nights, booking_rate, number_of_adults, number_of_children'
          )
          .in('property_id', propertyIds);

    const { data: bookingRows, error: bookingsError } = await bookingsQuery;

    if (bookingsError) {
      console.error('[list-properties] bookings', bookingsError.message);
      throw new Error('Failed to load property booking stats');
    }

    statsByPropertyId = computePropertyListStatsByPropertyId(bookingRows ?? []);
  }

  return jsonSuccess(req, {
    properties: properties.map((row) => ({
      ...serializeProperty(row),
      stats: propertyListStatsOrEmpty(statsByPropertyId, row.id as string),
    })),
  });
});
