/**
 * Live scenarios for the agentic guest receptionist, run against the local stack and a real
 * model. Skipped unless LOCAL_AI_AGENT_LIVE=1. Covers the surfaces wired to `runGuestReceptionistTurn`:
 * host "Suggest" (social-inbox-ai-suggest) today; web/Meta auto-reply are exercised indirectly
 * through the same turn function since they share no HTTP surface easy to seed end-to-end here.
 *
 *   docker exec -i supabase_db_guest-form-management psql -U postgres -d postgres \
 *     < scripts/dev/seed-agent-e2e.sql
 *   LOCAL_AI_AGENT_LIVE=1 deno test --allow-net --allow-env --allow-read --allow-import \
 *     supabase/functions/tests/guestReceptionistScenarios.integration_test.ts
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  ANON_KEY,
  loadAgentFixture,
  rest,
  resetLocalLimits,
  serviceHeaders,
} from './_agentHarness.ts';
import { LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';
import { executeGuestReceptionistTool } from '../_shared/guestReceptionistTools.ts';

const enabled = Deno.env.get('LOCAL_AI_AGENT_LIVE') === '1';
const live = { ignore: !enabled, sanitizeOps: false, sanitizeResources: false };

function manilaTodayMdY(offsetDays = 0): string {
  const manila = new Date(Date.now() + 8 * 3_600_000 + offsetDays * 86_400_000);
  const y = manila.getUTCFullYear();
  const m = String(manila.getUTCMonth() + 1).padStart(2, '0');
  const d = String(manila.getUTCDate()).padStart(2, '0');
  return `${m}-${d}-${y}`;
}

/** Clones a real booking row for the property so every NOT NULL field stays valid. */
async function seedGuestBooking(
  propertyId: string,
  guestUserId: string,
  checkInOffsetDays: number,
  checkOutOffsetDays: number
): Promise<string> {
  const [template] = await rest<Array<Record<string, unknown>>>(
    `guest_submissions?property_id=eq.${propertyId}&limit=1`
  );
  assert(template, 'needs a guest_submissions row for the test property to clone');
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    check_in_date_sql: _checkInSql,
    check_out_date_sql: _checkOutSql,
    ...base
  } = template;
  const [created] = await rest<Array<{ id: string }>>('guest_submissions', {
    method: 'POST',
    body: JSON.stringify({
      ...base,
      guest_user_id: guestUserId,
      status: 'COMPLETED',
      check_in_date: manilaTodayMdY(checkInOffsetDays),
      check_out_date: manilaTodayMdY(checkOutOffsetDays),
    }),
  });
  return created.id;
}

async function deleteRow(table: string, id: string): Promise<void> {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: serviceHeaders,
  });
}

async function clearMaintenanceRateLimit(guestUserId: string): Promise<void> {
  await fetch(
    `${LOCAL_SUPABASE_URL}/rest/v1/request_rate_limits?identity=eq.${guestUserId}&scope=eq.guest-ai-maintenance-report`,
    { method: 'DELETE', headers: serviceHeaders }
  );
}

async function clearGuestRequestRateLimit(
  guestUserId: string,
  scope: 'guest-ai-booking-inquiry' | 'guest-ai-checkinout-request'
): Promise<void> {
  await fetch(
    `${LOCAL_SUPABASE_URL}/rest/v1/request_rate_limits?identity=eq.${guestUserId}&scope=eq.${scope}`,
    { method: 'DELETE', headers: serviceHeaders }
  );
}

async function ensureWebConnection(orgId: string): Promise<string> {
  const [existing] = await rest<Array<{ id: string }>>(
    `social_channel_connections?organization_id=eq.${orgId}&platform=eq.web&limit=1`
  );
  if (existing) return existing.id;
  const [created] = await rest<Array<{ id: string }>>('social_channel_connections', {
    method: 'POST',
    body: JSON.stringify({
      organization_id: orgId,
      platform: 'web',
      external_account_id: `test-${orgId}`,
      status: 'connected',
    }),
  });
  return created.id;
}

async function seedConversation(
  orgId: string,
  propertyId: string,
  connectionId: string
): Promise<{ id: string }> {
  const [conv] = await rest<Array<{ id: string }>>('social_conversations', {
    method: 'POST',
    body: JSON.stringify({
      organization_id: orgId,
      connection_id: connectionId,
      platform: 'web',
      conversation_type: 'dm',
      external_thread_id: `test-thread-${crypto.randomUUID()}`,
      participant_name: 'Scenario Guest',
      property_id: propertyId,
      last_message_at: new Date().toISOString(),
    }),
  });
  return conv;
}

async function seedInbound(orgId: string, conversationId: string, bodyText: string): Promise<void> {
  await rest('social_messages', {
    method: 'POST',
    body: JSON.stringify({
      organization_id: orgId,
      conversation_id: conversationId,
      direction: 'inbound',
      external_message_id: `test-msg-${crypto.randomUUID()}`,
      body_text: bodyText,
      sent_at: new Date().toISOString(),
    }),
  });
}

async function deleteConversation(conversationId: string): Promise<void> {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/social_conversations?id=eq.${conversationId}`, {
    method: 'DELETE',
    headers: serviceHeaders,
  });
}

async function suggest(
  jwt: string,
  conversationId: string,
  propertyId: string
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/functions/v1/social-inbox-ai-suggest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ conversationId, property_id: propertyId }),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
}

Deno.test({
  name: 'host Suggest answers a guest burst from live tools without sending anything',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    await resetLocalLimits(fx);
    const connectionId = await ensureWebConnection(fx.orgId);
    const conv = await seedConversation(fx.orgId, fx.propertyId, connectionId);
    try {
      await seedInbound(fx.orgId, conv.id, 'Is there parking on site, and what time is check-in?');
      const { status, body } = await suggest(fx.jwt, conv.id, fx.propertyId);
      assertEquals(status, 200);
      assert(body?.success === true, `expected success: ${JSON.stringify(body)}`);
      const data = body?.data as Record<string, unknown>;
      assert(
        typeof data.suggestion === 'string' && data.suggestion.trim().length > 0,
        `expected a non-empty suggestion: ${JSON.stringify(data)}`
      );
      assertEquals(data.flagged, false);

      const [row] = await rest<Array<{ reply_status: string }>>(
        `social_conversations?id=eq.${conv.id}&select=reply_status`
      );
      // Suggest is a draft only — it never sends, so reply_status must stay untouched (none).
      assertEquals(row.reply_status, 'none');
    } finally {
      await deleteConversation(conv.id);
    }
  },
});

Deno.test({
  name: 'host Suggest never offers a handoff tool to the staff actor',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    await resetLocalLimits(fx);
    const connectionId = await ensureWebConnection(fx.orgId);
    const conv = await seedConversation(fx.orgId, fx.propertyId, connectionId);
    try {
      await seedInbound(fx.orgId, conv.id, 'I need to speak to a human right now, this is urgent.');
      const { status, body } = await suggest(fx.jwt, conv.id, fx.propertyId);
      assertEquals(status, 200);
      const data = body?.data as Record<string, unknown>;
      assert(typeof data.suggestion === 'string');
      // The staff actor has no handoff_to_host tool, so the conversation must not be flagged
      // handed-off by this call.
      const [row] = await rest<Array<{ ai_handoff_at: string | null }>>(
        `social_conversations?id=eq.${conv.id}&select=ai_handoff_at`
      );
      assertEquals(row.ai_handoff_at, null);
    } finally {
      await deleteConversation(conv.id);
    }
  },
});

Deno.test({
  name: 'report_maintenance_issue files a maintenance item and notifies the host',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    await clearMaintenanceRateLimit(fx.userId);
    const bookingId = await seedGuestBooking(fx.propertyId, fx.userId, -1, 1);
    let maintenanceItemId: string | null = null;
    try {
      const result = await executeGuestReceptionistTool({
        name: 'report_maintenance_issue',
        args: { description: 'The bathroom sink is leaking under the cabinet.' },
        propertyId: fx.propertyId,
        guestUserId: fx.userId,
      });
      assert(
        /filed/i.test(result.spokenText),
        `expected a filed confirmation: ${result.spokenText}`
      );

      const [item] = await rest<Array<{ id: string; category: string; notes: string }>>(
        `maintenance_items?property_id=eq.${fx.propertyId}&category=eq.Guest reported&order=created_at.desc&limit=1`
      );
      assert(item, 'expected a new maintenance_items row');
      maintenanceItemId = item.id;
      assert(item.notes.includes('leaking under the cabinet'));

      const [notification] = await rest<Array<{ type: string }>>(
        `notifications?type=eq.maintenance_guest_reported&metadata->>maintenanceItemId=eq.${item.id}`
      );
      assert(notification, 'expected a host notification for the new item');
    } finally {
      if (maintenanceItemId) await deleteRow('maintenance_items', maintenanceItemId);
      await deleteRow('guest_submissions', bookingId);
    }
  },
});

Deno.test({
  name: 'report_maintenance_issue refuses a guest with no active stay',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    await clearMaintenanceRateLimit(fx.userId);
    // Checked out 10 days ago — not an active stay.
    const bookingId = await seedGuestBooking(fx.propertyId, fx.userId, -12, -10);
    try {
      const result = await executeGuestReceptionistTool({
        name: 'report_maintenance_issue',
        args: { description: 'The AC is not cooling.' },
        propertyId: fx.propertyId,
        guestUserId: fx.userId,
      });
      assert(
        /stay in progress/i.test(result.spokenText),
        `expected a refusal: ${result.spokenText}`
      );
      const items = await rest<Array<{ id: string }>>(
        `maintenance_items?property_id=eq.${fx.propertyId}&category=eq.Guest reported&notes=ilike.*not cooling*`
      );
      assertEquals(items.length, 0, 'no item should be filed for a stay that is not active');
    } finally {
      await deleteRow('guest_submissions', bookingId);
    }
  },
});

Deno.test({
  name: 'report_maintenance_issue is rate-limited to 3 reports a day per guest',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    await clearMaintenanceRateLimit(fx.userId);
    const bookingId = await seedGuestBooking(fx.propertyId, fx.userId, -1, 1);
    const createdItemIds: string[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const result = await executeGuestReceptionistTool({
          name: 'report_maintenance_issue',
          args: { description: `Rate limit probe ${i} — a flickering hallway light.` },
          propertyId: fx.propertyId,
          guestUserId: fx.userId,
        });
        assert(
          /filed/i.test(result.spokenText),
          `report ${i} should succeed: ${result.spokenText}`
        );
      }
      const fourth = await executeGuestReceptionistTool({
        name: 'report_maintenance_issue',
        args: { description: 'Rate limit probe 3 — one too many.' },
        propertyId: fx.propertyId,
        guestUserId: fx.userId,
      });
      assert(
        /limit/i.test(fourth.spokenText),
        `the 4th report should be rate-limited: ${fourth.spokenText}`
      );

      const items = await rest<Array<{ id: string }>>(
        `maintenance_items?property_id=eq.${fx.propertyId}&notes=ilike.*Rate limit probe*&select=id`
      );
      assertEquals(items.length, 3, 'exactly 3 reports should have been filed');
      createdItemIds.push(...items.map((i) => i.id));
    } finally {
      for (const id of createdItemIds) await deleteRow('maintenance_items', id);
      await deleteRow('guest_submissions', bookingId);
      await clearMaintenanceRateLimit(fx.userId);
    }
  },
});

Deno.test({
  name: 'request_booking_inquiry creates a guest request and notifies the host',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    await clearGuestRequestRateLimit(fx.userId, 'guest-ai-booking-inquiry');
    let requestId: string | null = null;
    try {
      const result = await executeGuestReceptionistTool({
        name: 'request_booking_inquiry',
        args: { checkIn: '2027-03-10', checkOut: '2027-03-14', guestCount: 2 },
        orgId: fx.orgId,
        propertyId: fx.propertyId,
        guestUserId: fx.userId,
      });
      assert(
        /sent your inquiry/i.test(result.spokenText),
        `expected a confirmation: ${result.spokenText}`
      );

      const [row] = await rest<
        Array<{ id: string; kind: string; status: string; payload: Record<string, unknown> }>
      >(
        `guest_requests?guest_user_id=eq.${fx.userId}&kind=eq.booking_inquiry&order=created_at.desc&limit=1`
      );
      assert(row, 'expected a new guest_requests row');
      requestId = row.id;
      assertEquals(row.status, 'pending');
      assertEquals(row.payload.checkIn, '2027-03-10');
      assertEquals(row.payload.guestCount, 2);

      const [notification] = await rest<Array<{ type: string }>>(
        `notifications?type=eq.guest_request_submitted&metadata->>guestRequestId=eq.${row.id}`
      );
      assert(notification, 'expected a host notification for the new request');
    } finally {
      if (requestId) await deleteRow('guest_requests', requestId);
      await clearGuestRequestRateLimit(fx.userId, 'guest-ai-booking-inquiry');
    }
  },
});

Deno.test({
  name: 'request_booking_inquiry refuses an unsigned-in guest',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    const result = await executeGuestReceptionistTool({
      name: 'request_booking_inquiry',
      args: { checkIn: '2027-03-10', checkOut: '2027-03-14', guestCount: 2 },
      orgId: fx.orgId,
      propertyId: fx.propertyId,
      guestUserId: null,
    });
    assert(
      /signed in/i.test(result.spokenText),
      `expected a sign-in refusal: ${result.spokenText}`
    );
  },
});

Deno.test({
  name: 'request_booking_inquiry is rate-limited to 3 requests a day per guest',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    await clearGuestRequestRateLimit(fx.userId, 'guest-ai-booking-inquiry');
    const createdIds: string[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const result = await executeGuestReceptionistTool({
          name: 'request_booking_inquiry',
          args: { checkIn: '2027-04-01', checkOut: '2027-04-05', guestCount: 1 + i },
          orgId: fx.orgId,
          propertyId: fx.propertyId,
          guestUserId: fx.userId,
        });
        assert(/sent your inquiry/i.test(result.spokenText), `inquiry ${i} should succeed`);
      }
      const fourth = await executeGuestReceptionistTool({
        name: 'request_booking_inquiry',
        args: { checkIn: '2027-04-10', checkOut: '2027-04-12', guestCount: 1 },
        orgId: fx.orgId,
        propertyId: fx.propertyId,
        guestUserId: fx.userId,
      });
      assert(/limit/i.test(fourth.spokenText), `the 4th inquiry should be rate-limited`);

      const rows = await rest<Array<{ id: string }>>(
        `guest_requests?guest_user_id=eq.${fx.userId}&kind=eq.booking_inquiry&payload->>checkOut=eq.2027-04-05&select=id`
      );
      createdIds.push(...rows.map((r) => r.id));
    } finally {
      for (const id of createdIds) await deleteRow('guest_requests', id);
      await clearGuestRequestRateLimit(fx.userId, 'guest-ai-booking-inquiry');
    }
  },
});

Deno.test({
  name: 'request_early_checkin_late_checkout creates a guest request tied to the booking',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    await clearGuestRequestRateLimit(fx.userId, 'guest-ai-checkinout-request');
    const bookingId = await seedGuestBooking(fx.propertyId, fx.userId, -1, 1);
    let requestId: string | null = null;
    try {
      const result = await executeGuestReceptionistTool({
        name: 'request_early_checkin_late_checkout',
        args: { requestType: 'early_checkin', requestedTime: '11:00 AM' },
        orgId: fx.orgId,
        propertyId: fx.propertyId,
        guestUserId: fx.userId,
      });
      assert(
        /sent your request/i.test(result.spokenText),
        `expected a confirmation: ${result.spokenText}`
      );

      const [row] = await rest<Array<{ id: string; booking_id: string; status: string }>>(
        `guest_requests?guest_user_id=eq.${fx.userId}&kind=eq.early_checkin_late_checkout&order=created_at.desc&limit=1`
      );
      assert(row, 'expected a new guest_requests row');
      requestId = row.id;
      assertEquals(row.booking_id, bookingId);
      assertEquals(row.status, 'pending');
    } finally {
      if (requestId) await deleteRow('guest_requests', requestId);
      await deleteRow('guest_submissions', bookingId);
      await clearGuestRequestRateLimit(fx.userId, 'guest-ai-checkinout-request');
    }
  },
});

Deno.test({
  name: 'request_early_checkin_late_checkout refuses a guest with no booking at this property',
  ...live,
  fn: async () => {
    const fx = await loadAgentFixture();
    const result = await executeGuestReceptionistTool({
      name: 'request_early_checkin_late_checkout',
      args: { requestType: 'late_checkout', requestedTime: '2:00 PM' },
      orgId: fx.orgId,
      propertyId: fx.propertyId,
      guestUserId: '00000000-0000-4000-8000-000000000099',
    });
    assert(
      /own booking/i.test(result.spokenText),
      `expected a refusal without a booking: ${result.spokenText}`
    );
  },
});
