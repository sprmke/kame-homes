-- Host announcements — mock platform + development rows for local manual QA.
-- Platform → every signed-in host (/admin/announcements).
-- Development → Azure North Residences hosts (/admin/developments/azure-north-residences).
-- Safe to re-run: replaces only ids prefixed ann-mock-platform-* / ann-mock-dev-*.
-- Apply: bun run seed:host-announcements

DO $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_now_iso TEXT := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_mock_platform JSONB := jsonb_build_array(
    jsonb_build_object(
      'id', 'ann-mock-platform-critical',
      'title', 'Verify payout account',
      'body', 'Some hosts must reconfirm PayMongo payout details before the next billing cycle. Open Finance if you see a banner on your org dashboard.',
      'severity', 'critical',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-platform-warning',
      'title', 'Billing portal update',
      'body', 'Org Plans checkout is rolling out this week. If checkout fails, retry in a few minutes or open a support ticket.',
      'severity', 'warning',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-platform-warning-2',
      'title', 'Meta inbox reconnect',
      'body', 'Facebook and Instagram channels may show Disconnected until you re-authorize from Inbox → Channels. Guest messages are still stored.',
      'severity', 'warning',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-platform-info',
      'title', 'Platform maintenance window',
      'body', 'Dashboard and API may be briefly unavailable this Sunday, 2:00–4:00 AM (Asia/Manila). Host bookings and guest forms are unaffected.',
      'severity', 'info',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', 'https://kamehomes.space/help-support/announcements',
      'linkLabel', 'Learn more',
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-platform-info-2',
      'title', 'AI assistant on Business plans',
      'body', 'Ask AI in Help & Support now reads your bookings and inbox context on Business and Enterprise tiers. Upgrade from Plans & Billing if the launcher is locked.',
      'severity', 'info',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-platform-info-3',
      'title', 'Guest portal sign-in',
      'body', 'Guests can now manage trips and chat from the account portal without re-submitting the booking form. No host action required.',
      'severity', 'info',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-platform-info-4',
      'title', 'Marketing Studio exports',
      'body', 'Video and design exports keep the same filenames as before; large exports may take up to a minute on slow connections.',
      'severity', 'info',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    )
  );
  v_mock_development JSONB := jsonb_build_array(
    jsonb_build_object(
      'id', 'ann-mock-dev-critical',
      'title', 'Elevator B inspection',
      'body', 'Elevator B is out of service Wed–Thu while the management company completes its annual inspection. Use Elevator A or the stairs.',
      'severity', 'critical',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-dev-warning',
      'title', 'Lagoon pool maintenance',
      'body', 'The lagoon pool is closed every Tuesday, 8:00 AM–12:00 PM, for cleaning. Pool fee still applies on open days (₱200 per guest).',
      'severity', 'warning',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-dev-warning-2',
      'title', 'Fire drill schedule',
      'body', 'Building-wide fire drill on the first Friday of the month, 10:00 AM. Brief alarm; no evacuation required for short-stay guests unless announced onsite.',
      'severity', 'warning',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-dev-warning-3',
      'title', 'Water interruption',
      'body', 'Low-pressure water service Saturday 6:00–9:00 AM for pipe flushing on floors 12–18. Affected units were notified by the building admin.',
      'severity', 'warning',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-dev-info',
      'title', 'Front desk ID check',
      'body', 'All guests must present a valid government ID at Azure North security before unit access. Share this with guests before check-in.',
      'severity', 'info',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', 'https://example.com/azure-north-guest-guide',
      'linkLabel', 'Guest guide',
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-dev-info-2',
      'title', 'Basement parking hours',
      'body', 'Visitor parking slots close at 10:00 PM daily. Registered guest vehicles may enter until midnight with a valid booking reference.',
      'severity', 'info',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    ),
    jsonb_build_object(
      'id', 'ann-mock-dev-info-3',
      'title', 'Gym reservation app',
      'body', 'The fitness center now requires a same-day slot in the building app. Hosts can share the QR at the front desk with guests on check-in.',
      'severity', 'info',
      'active', true,
      'startsAt', null,
      'endsAt', null,
      'linkUrl', null,
      'linkLabel', null,
      'updatedAt', v_now_iso
    )
  );
  v_platform_kept JSONB;
  v_dev_kept JSONB;
  v_dev_slug TEXT := 'azure-north-residences';
BEGIN
  INSERT INTO public.platform_host_settings (id, announcements)
  VALUES (TRUE, '[]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  INTO v_platform_kept
  FROM public.platform_host_settings phs,
       jsonb_array_elements(phs.announcements) AS elem
  WHERE phs.id = TRUE
    AND elem->>'id' NOT LIKE 'ann-mock-platform-%';

  UPDATE public.platform_host_settings
  SET
    announcements = v_platform_kept || v_mock_platform,
    updated_at = v_now
  WHERE id = TRUE;

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  INTO v_dev_kept
  FROM public.developments d,
       jsonb_array_elements(COALESCE(d.settings->'announcements', '[]'::jsonb)) AS elem
  WHERE d.slug = v_dev_slug
    AND elem->>'id' NOT LIKE 'ann-mock-dev-%';

  UPDATE public.developments
  SET
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{announcements}',
      v_dev_kept || v_mock_development,
      true
    ),
    updated_at = v_now
  WHERE slug = v_dev_slug;

  IF NOT FOUND THEN
    RAISE NOTICE 'seed-host-announcements: development % not found — platform mocks applied only', v_dev_slug;
  ELSE
    RAISE NOTICE 'seed-host-announcements: platform (7) + % development (7) mocks applied', v_dev_slug;
  END IF;
END $$;
