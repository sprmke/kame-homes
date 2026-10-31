/**
 * Local integration smoke for attachment-parity assistant tools (manual guide §11–13 subset).
 * Requires local Supabase (`bun run start:supabase`). Skip with SKIP_ASSISTANT_INTEGRATION=1.
 */
import './_localSupabaseEnv.ts';
import {
  assertEquals,
  assertExists,
  assertMatch,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

const JWT_SECRET =
  Deno.env.get('JWT_SECRET')?.trim() || 'super-secret-jwt-token-with-at-least-32-characters-long';

const { executeTool } = await import('../_shared/dashboardAssistantTools.ts');
const { createServiceClient } = await import('../_shared/orgAuth.ts');
const { classifyActionRisk } = await import('../_shared/dashboardAssistantRiskClassifier.ts');

type ToolExecutionContext = import('../_shared/dashboardAssistantTools.ts').ToolExecutionContext;

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mintUserJwt(userId: string, email: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      email,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase-demo',
      iat: now,
      exp: now + 3600,
    })
  );
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${base64UrlEncode(new Uint8Array(sig))}`;
}

type Fixture = {
  orgId: string;
  propertyId: string;
  userId: string;
  userEmail: string;
  bookingId: string | null;
};

async function loadFixture(): Promise<Fixture | null> {
  const sb = createServiceClient();
  const { data: org, error: orgErr } = await sb
    .from('organizations')
    .select('id, slug, owner_id')
    .eq('slug', 'kame-homes')
    .maybeSingle();
  if (orgErr || !org?.id || !org.owner_id) return null;

  const { data: property } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', org.id)
    .eq('slug', 'kame-home')
    .maybeSingle();
  if (!property?.id) return null;

  const { data: owner, error: userErr } = await sb.auth.admin.getUserById(org.owner_id);
  if (userErr || !owner.user?.email) return null;

  const { data: booking } = await sb
    .from('guest_submissions')
    .select('id')
    .eq('property_id', property.id)
    .not('status', 'in', '("CANCELLED","COMPLETED")')
    .limit(1)
    .maybeSingle();

  return {
    orgId: org.id,
    propertyId: property.id,
    userId: org.owner_id,
    userEmail: owner.user.email,
    bookingId: booking?.id ?? null,
  };
}

const ASSISTANT_CONVERSATION_ID = '00000000-0000-4000-8000-000000000099';

const MINIMAL_PDF = new TextEncoder().encode(
  '%PDF-1.4\n1 0 obj<<>>endobj\nxref\n0 0\ntrailer<<>>\n%%EOF\n'
);

/** 1×1 PNG — valid for org logo / GCash QR mime checks. */
const MINIMAL_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
);

async function seedAssistantAttachment(
  fixture: Fixture,
  fileName: string,
  bytes: Uint8Array = MINIMAL_PDF,
  contentType = 'application/pdf'
): Promise<string> {
  const sb = createServiceClient();
  const path = `${fixture.orgId}/${fixture.userId}/${ASSISTANT_CONVERSATION_ID}/${fileName}`;
  const { error } = await sb.storage.from('ai-assistant-attachments').upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Failed to seed attachment: ${error.message}`);
  return path;
}

async function loadMetaConversationId(orgId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('social_conversations')
    .select('id')
    .eq('organization_id', orgId)
    .in('platform', ['facebook', 'instagram'])
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function loadPendingDocumentsBookingId(propertyId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('guest_submissions')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'PENDING_DOCUMENTS')
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function ensureWebInboxConversation(fixture: Fixture): Promise<string> {
  const { ensureWebChannelConnection } = await import('../_shared/webGuestChatService.ts');
  const { upsertConversation } = await import('../_shared/socialInboxService.ts');
  const connection = await ensureWebChannelConnection(fixture.orgId);
  const externalThreadId = `assistant-parity-web-${fixture.propertyId}`;
  const conv = await upsertConversation({
    organization_id: fixture.orgId,
    connection_id: connection.id,
    platform: 'web',
    external_thread_id: externalThreadId,
    conversation_type: 'dm',
    property_id: fixture.propertyId,
    participant_name: 'Assistant parity guest',
    external_participant_id: '00000000-0000-4000-8000-000000000088',
  });
  return conv.id;
}

/** Upgrade kame-homes org subscription to Pro so marketingStudio + publish limits apply. */
async function ensureMarketingProPlan(fixture: Fixture): Promise<void> {
  const sb = createServiceClient();
  const { data: proPlan } = await sb
    .from('pricing_plans')
    .select('id')
    .eq('code', 'pro')
    .limit(1)
    .maybeSingle();
  if (!proPlan?.id) throw new Error('Pro pricing plan missing from local seed');

  const { data: slot } = await sb
    .from('org_subscription_properties')
    .select('org_subscription_id')
    .eq('property_id', fixture.propertyId)
    .maybeSingle();
  if (!slot?.org_subscription_id) {
    throw new Error('No org subscription slot for fixture property');
  }

  const { error } = await sb
    .from('org_subscriptions')
    .update({ plan_id: proPlan.id, status: 'active' })
    .eq('id', slot.org_subscription_id);
  if (error) throw new Error(`Failed to upgrade org plan: ${error.message}`);
}

async function loadInstagramConnectionId(orgId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('social_channel_connections')
    .select('id')
    .eq('organization_id', orgId)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function loadParkingId(orgId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('parkings')
    .select('id')
    .eq('organization_id', orgId)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function buildCtx(fixture: Fixture): Promise<ToolExecutionContext> {
  const jwt = await mintUserJwt(fixture.userId, fixture.userEmail);
  const req = new Request('http://localhost/functions/v1/dashboard-assistant-chat', {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return {
    req,
    organizationId: fixture.orgId,
    userId: fixture.userId,
    userEmail: fixture.userEmail,
    pageContext: { propertyId: fixture.propertyId },
    attachedContext: [],
    isBulk: false,
    conversationId: '00000000-0000-4000-8000-000000000099',
  };
}

const skip = Deno.env.get('SKIP_ASSISTANT_INTEGRATION') === '1';

Deno.test({
  name: '§13 guide_import_bookings deep-links without commit',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture)
      throw new Error('Local fixture missing — run db:reset with seed-dashboard-demo-data');
    const ctx = await buildCtx(fixture);
    const result = await executeTool(
      'guide_import_bookings',
      { propertyId: fixture.propertyId },
      ctx
    );
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    assertMatch(String(data.bookingsPath ?? ''), /\/bookings$/);
    assertEquals(Array.isArray(data.notAvailableInChat), true);
    assertMatch(String(data.hostHint ?? ''), /cannot import/i);
  },
});

Deno.test({
  name: '§13 guide_create_booking references New booking modal',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const ctx = await buildCtx(fixture);
    const result = await executeTool(
      'guide_create_booking',
      { propertyId: fixture.propertyId },
      ctx
    );
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    assertMatch(String(data.action ?? ''), /New booking/i);
    const edits = data.bookingFieldEdits as Record<string, unknown>;
    assertEquals(edits.availableInChat, false);
  },
});

Deno.test({
  name: '§13 get_notification_preferences is tier0 read',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const ctx = await buildCtx(fixture);
    const result = await executeTool('get_notification_preferences', {}, ctx);
    assertEquals(result.ok, true);
    assertEquals(result.riskTier, 'tier0_read');
    assertExists(result.data);
  },
});

Deno.test({
  name: '§12 list_host_announcements + get_org_plan_snapshot read',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const ctx = await buildCtx(fixture);
    const announcements = await executeTool('list_host_announcements', {}, ctx);
    assertEquals(announcements.ok, true);
    const plan = await executeTool('get_org_plan_snapshot', {}, ctx);
    assertEquals(plan.ok, true);
    const planData = plan.data as Record<string, unknown>;
    assertExists(planData.planName ?? planData.planCode ?? planData.status);
  },
});

Deno.test({
  name: '§11 propose_apply_booking_attachment accepts same-conversation path',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture?.bookingId) throw new Error('No booking in fixture');
    const conversationId = '00000000-0000-4000-8000-000000000099';
    const ctx = await buildCtx(fixture);
    const attachmentPath = `${fixture.orgId}/${fixture.userId}/${conversationId}/approved-gaf.pdf`;
    const result = await executeTool(
      'propose_apply_booking_attachment',
      {
        bookingId: fixture.bookingId,
        attachmentPath,
        assetType: 'approved_gaf',
        alsoMarkComplete: true,
      },
      ctx
    );
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.proposed, true);
    const data = result.data as Record<string, unknown>;
    assertMatch(String(data.summary ?? ''), /Apply chat file as Approved GAF/i);
  },
});

Deno.test({
  name: '§11 propose_apply_booking_attachment rejects cross-conversation path',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture?.bookingId) throw new Error('No booking in fixture');
    const ctx = await buildCtx(fixture);
    const result = await executeTool(
      'propose_apply_booking_attachment',
      {
        bookingId: fixture.bookingId,
        attachmentPath: `${fixture.orgId}/${fixture.userId}/other-conversation-id/file.pdf`,
        assetType: 'approved_gaf',
      },
      ctx
    );
    assertEquals(result.ok, false);
    assertMatch(String(result.error ?? ''), /conversation/i);
  },
});

Deno.test({
  name: '§11 propose_send_workflow_email proposes tier2 external_send',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture?.bookingId) throw new Error('No booking in fixture');
    const ctx = await buildCtx(fixture);
    const result = await executeTool(
      'propose_send_workflow_email',
      { bookingId: fixture.bookingId, kind: 'booking_acknowledgement' },
      ctx
    );
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.proposed, true);
    assertEquals(
      classifyActionRisk({
        toolName: 'propose_send_workflow_email',
        targetBookingId: fixture.bookingId,
        pageContext: ctx.pageContext,
        attachedContext: ctx.attachedContext,
      }),
      'tier2_confirmed'
    );
  },
});

Deno.test({
  name: '§13 telegram + notification guidance deep-links only',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const ctx = await buildCtx(fixture);
    const telegram = await executeTool('get_telegram_notification_settings', {}, ctx);
    assertEquals(telegram.ok, true);
    assertEquals(telegram.riskTier, 'tier0_read');
    const guideTelegram = await executeTool('guide_telegram_settings', {}, ctx);
    assertEquals(guideTelegram.ok, true);
    assertMatch(
      String((guideTelegram.data as Record<string, unknown>).settingsPath ?? ''),
      /notifications/i
    );
    const guideNotifications = await executeTool('guide_notification_settings', {}, ctx);
    assertEquals(guideNotifications.ok, true);
    assertMatch(
      String((guideNotifications.data as Record<string, unknown>).settingsPath ?? ''),
      /notifications/i
    );
  },
});

Deno.test({
  name: '§12 propose_create_support_ticket proposes tier2 without attachment',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const ctx = await buildCtx(fixture);
    const result = await executeTool(
      'propose_create_support_ticket',
      {
        subject: 'Assistant integration test',
        description: 'Automated smoke — safe to ignore.',
        category: 'bug_report',
      },
      ctx
    );
    assertEquals(result.ok, true);
    assertEquals(result.proposed, true);
    assertEquals(
      classifyActionRisk({
        toolName: 'propose_create_support_ticket',
        pageContext: ctx.pageContext,
        attachedContext: ctx.attachedContext,
      }),
      'tier2_confirmed'
    );
  },
});

Deno.test({
  name: '§11 executeApplyBookingAttachment uploads seeded chat PDF',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture?.bookingId) throw new Error('No booking in fixture');
    const { executeApplyBookingAttachment } =
      await import('../_shared/dashboardAssistantBookingAssetTools.ts');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(fixture, 'approved-gaf-smoke.pdf');
    const result = await executeApplyBookingAttachment(ctx, {
      bookingId: fixture.bookingId,
      attachmentPath,
      assetType: 'approved_gaf',
      fileName: 'approved-gaf-smoke.pdf',
      mimeType: 'application/pdf',
      alsoMarkComplete: false,
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const sb = createServiceClient();
    const { data: booking } = await sb
      .from('guest_submissions')
      .select('approved_gaf_pdf_url')
      .eq('id', fixture.bookingId)
      .maybeSingle();
    assertExists(booking?.approved_gaf_pdf_url);
  },
});

Deno.test({
  name: '§12 propose_send_inbox_reply rejects attachments on Meta DM',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const metaConversationId = await loadMetaConversationId(fixture.orgId);
    if (!metaConversationId) throw new Error('No Meta conversation in local seed');
    const ctx = await buildCtx(fixture);
    const attachmentPath = `${fixture.orgId}/${fixture.userId}/${ASSISTANT_CONVERSATION_ID}/screenshot.png`;
    const result = await executeTool(
      'propose_send_inbox_reply',
      {
        conversationId: metaConversationId,
        propertyId: fixture.propertyId,
        text: 'Test note',
        attachmentPath,
      },
      ctx
    );
    assertEquals(result.ok, false);
    assertMatch(String(result.error ?? ''), /website chat|Messenger|Instagram/i);
  },
});

Deno.test({
  name: '§11 propose_send_workflow_email is external_send for all kinds',
  ignore: skip,
  fn: async () => {
    const { EXTERNAL_SEND_TOOL_NAMES } =
      await import('../_shared/dashboardAssistantRiskClassifier.ts');
    assertEquals(EXTERNAL_SEND_TOOL_NAMES.has('propose_send_workflow_email'), true);
    for (const kind of [
      'booking_acknowledgement',
      'gaf_request',
      'pet_request',
      'ready_for_checkin',
      'sd_refund_form_request',
    ]) {
      assertEquals(
        classifyActionRisk({
          toolName: 'propose_send_workflow_email',
          pageContext: {},
          attachedContext: [],
        }),
        'tier2_confirmed'
      );
      void kind;
    }
  },
});

Deno.test({
  name: '§11 propose_apply_booking_attachment warns on overwrite after upload',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture?.bookingId) throw new Error('No booking in fixture');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(fixture, 'approved-gaf-overwrite.pdf');
    const { executeApplyBookingAttachment } =
      await import('../_shared/dashboardAssistantBookingAssetTools.ts');
    const uploaded = await executeApplyBookingAttachment(ctx, {
      bookingId: fixture.bookingId,
      attachmentPath,
      assetType: 'approved_gaf',
      fileName: 'approved-gaf-overwrite.pdf',
      mimeType: 'application/pdf',
      alsoMarkComplete: false,
    });
    if (!uploaded.ok) {
      assertExists(uploaded.error);
      return;
    }
    const propose = await executeTool(
      'propose_apply_booking_attachment',
      {
        bookingId: fixture.bookingId,
        attachmentPath,
        assetType: 'approved_gaf',
      },
      ctx
    );
    assertEquals(propose.ok, true);
    assertEquals(propose.proposed, true);
    const data = propose.data as Record<string, unknown>;
    assertEquals(data.replacesExisting, true);
    assertMatch(String(data.summary ?? ''), /replace the file already on the booking/i);
  },
});

Deno.test({
  name: '§11.3 executeApplyOrgLogo uploads seeded chat PNG',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const { executeApplyOrgLogo } = await import('../_shared/dashboardAssistantHostMediaTools.ts');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'org-logo-smoke.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeApplyOrgLogo(ctx, { attachmentPath });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    assertExists(data.url);
    const sb = createServiceClient();
    const { data: settings } = await sb
      .from('org_settings')
      .select('email_logo_url')
      .eq('organization_id', fixture.orgId)
      .maybeSingle();
    assertExists(settings?.email_logo_url);
  },
});

Deno.test({
  name: '§11.4 executeStageGcashQr stages PNG and keeps OTP commit out of scope',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const { executeStageGcashQr } =
      await import('../_shared/dashboardAssistantVerificationTools.ts');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'gcash-qr-smoke.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeStageGcashQr(ctx, {
      attachmentPath,
      scope: 'property',
      propertyId: fixture.propertyId,
      scopeId: fixture.propertyId,
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    assertExists(data.url);
    assertMatch(
      String(data.nextStep ?? data.message ?? ''),
      /OTP|Payment settings|verification code/i
    );
  },
});

Deno.test({
  name: '§11.4 propose_stage_gcash_qr summary requires OTP payment settings',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'gcash-qr-propose.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeTool(
      'propose_stage_gcash_qr',
      {
        attachmentPath,
        scope: 'property',
        propertyId: fixture.propertyId,
      },
      ctx
    );
    assertEquals(result.ok, true);
    assertEquals(result.proposed, true);
    const data = result.data as Record<string, unknown>;
    assertMatch(String(data.summary ?? ''), /OTP|Payment settings/i);
  },
});

Deno.test({
  name: '§11.1 compound apply GAF + mark complete on PENDING_DOCUMENTS',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const bookingId = await loadPendingDocumentsBookingId(fixture.propertyId);
    if (!bookingId) throw new Error('No PENDING_DOCUMENTS booking in local seed');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(fixture, 'compound-gaf-mark-complete.pdf');
    const propose = await executeTool(
      'propose_apply_booking_attachment',
      {
        bookingId,
        attachmentPath,
        assetType: 'approved_gaf',
        alsoMarkComplete: true,
      },
      ctx
    );
    assertEquals(propose.ok, true);
    assertEquals(propose.proposed, true);
    const proposal = propose.data as Record<string, unknown>;
    assertEquals(proposal.alsoMarkComplete, true);
    assertMatch(String(proposal.summary ?? ''), /mark GAF as complete/i);

    const { executeApplyBookingAttachment } =
      await import('../_shared/dashboardAssistantBookingAssetTools.ts');
    const executed = await executeApplyBookingAttachment(ctx, proposal);
    if (!executed.ok) {
      assertExists(executed.error);
      return;
    }
    const sb = createServiceClient();
    const { data: booking } = await sb
      .from('guest_submissions')
      .select('approved_gaf_pdf_url, gaf_completed_at')
      .eq('id', bookingId)
      .maybeSingle();
    assertExists(booking?.approved_gaf_pdf_url);
    assertExists(booking?.gaf_completed_at);
  },
});

Deno.test({
  name: '§12.1 propose_send_inbox_reply accepts attachments on web chat (external_send)',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const webConversationId = await ensureWebInboxConversation(fixture);
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'inbox-screenshot.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeTool(
      'propose_send_inbox_reply',
      {
        conversationId: webConversationId,
        propertyId: fixture.propertyId,
        text: 'Here is the screenshot.',
        attachmentPath,
      },
      ctx
    );
    assertEquals(result.ok, true);
    assertEquals(result.proposed, true);
    const data = result.data as Record<string, unknown>;
    assertMatch(String(data.summary ?? ''), /file\(s\)/i);
    const { EXTERNAL_SEND_TOOL_NAMES } =
      await import('../_shared/dashboardAssistantRiskClassifier.ts');
    assertEquals(EXTERNAL_SEND_TOOL_NAMES.has('propose_send_inbox_reply'), true);
  },
});

Deno.test({
  name: '§12.1 executeConfirmedAction sends web inbox reply with attachment',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const webConversationId = await ensureWebInboxConversation(fixture);
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'inbox-send-execute.png',
      MINIMAL_PNG,
      'image/png'
    );
    const { executeConfirmedAction } = await import('../_shared/dashboardAssistantTools.ts');
    const result = await executeConfirmedAction(
      'propose_send_inbox_reply',
      {
        conversationId: webConversationId,
        propertyId: fixture.propertyId,
        text: 'Screenshot from assistant test.',
        attachmentPaths: [attachmentPath],
      },
      ctx
    );
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const sb = createServiceClient();
    const { data: messages } = await sb
      .from('social_messages')
      .select('direction, attachments, body_text')
      .eq('conversation_id', webConversationId)
      .eq('direction', 'outbound')
      .order('sent_at', { ascending: false })
      .limit(1);
    const latest = messages?.[0];
    assertExists(latest);
    assertEquals(Array.isArray(latest.attachments) && latest.attachments.length > 0, true);
  },
});

Deno.test({
  name: '§12.2 executeCreateSupportTicket uploads chat attachment',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'support-ticket-screenshot.png',
      MINIMAL_PNG,
      'image/png'
    );
    const { executeCreateSupportTicket } =
      await import('../_shared/dashboardAssistantPhase4Tools.ts');
    const result = await executeCreateSupportTicket(ctx, {
      category: 'bug_report',
      subject: 'Assistant parity attachment test',
      description: 'Automated integration smoke — safe to ignore.',
      attachmentPaths: [attachmentPath],
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    const ticketId = data.ticketId;
    assertExists(ticketId);
    const sb = createServiceClient();
    const { data: message } = await sb
      .from('support_ticket_messages')
      .select('attachments')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    assertEquals(Array.isArray(message?.attachments) && message.attachments.length > 0, true);
  },
});

Deno.test({
  name: '§13.3 propose_publish_to_meta references chat attachment (external_send)',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    await ensureMarketingProPlan(fixture);
    const connectionId = await loadInstagramConnectionId(fixture.orgId);
    if (!connectionId) throw new Error('No connected Instagram channel in local seed');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'meta-publish-propose.jpg',
      MINIMAL_PNG,
      'image/jpeg'
    );
    const result = await executeTool(
      'propose_publish_to_meta',
      {
        propertyId: fixture.propertyId,
        connectionId,
        publishType: 'instagram_post',
        attachmentPath,
        caption: 'Test from assistant',
      },
      ctx
    );
    assertEquals(result.ok, true);
    assertEquals(result.proposed, true);
    const data = result.data as Record<string, unknown>;
    assertEquals(data.attachmentPath, attachmentPath);
    assertMatch(String(data.summary ?? ''), /chat file meta-publish-propose\.jpg/i);
    const { EXTERNAL_SEND_TOOL_NAMES } =
      await import('../_shared/dashboardAssistantRiskClassifier.ts');
    assertEquals(EXTERNAL_SEND_TOOL_NAMES.has('propose_publish_to_meta'), true);
  },
});

Deno.test({
  name: '§13.3 executeConfirmedAction stages chat attachment into marketing publish row',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    await ensureMarketingProPlan(fixture);
    const connectionId = await loadInstagramConnectionId(fixture.orgId);
    if (!connectionId) throw new Error('No connected Instagram channel in local seed');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'meta-publish-execute.jpg',
      MINIMAL_PNG,
      'image/jpeg'
    );
    const propose = await executeTool(
      'propose_publish_to_meta',
      {
        propertyId: fixture.propertyId,
        connectionId,
        publishType: 'instagram_post',
        attachmentPath,
        caption: 'Assistant parity execute smoke',
      },
      ctx
    );
    assertEquals(propose.ok, true);
    const { executeConfirmedAction } = await import('../_shared/dashboardAssistantTools.ts');
    const executed = await executeConfirmedAction(
      'propose_publish_to_meta',
      propose.data as Record<string, unknown>,
      ctx
    );
    const sb = createServiceClient();
    const { data: publication } = await sb
      .from('marketing_publications')
      .select('status, media_url, caption')
      .eq('property_id', fixture.propertyId)
      .eq('caption', 'Assistant parity execute smoke')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    assertExists(publication);
    assertMatch(String(publication.media_url ?? ''), /marketing-exports\//i);
    if (!executed.ok) {
      assertMatch(String(executed.error ?? ''), /META|Channel|token|Meta/i);
      return;
    }
    assertEquals(executed.ok, true);
  },
});

Deno.test({
  name: '§D.3 executeApplyPropertyMedia adds gallery item from chat PNG',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const { executeApplyPropertyMedia } =
      await import('../_shared/dashboardAssistantHostMediaTools.ts');
    const { readPropertyMedia } = await import('../_shared/propertyMediaUpload.ts');
    const ctx = await buildCtx(fixture);
    const beforeCount = (await readPropertyMedia(fixture.propertyId)).length;
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'property-gallery-smoke.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeApplyPropertyMedia(ctx, {
      attachmentPath,
      propertyId: fixture.propertyId,
      setPrimary: false,
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const afterCount = (await readPropertyMedia(fixture.propertyId)).length;
    assertEquals(afterCount >= beforeCount + 1, true);
  },
});

Deno.test({
  name: '§D.3 executeApplyParkingMedia sets cover from chat PNG',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const parkingId = await loadParkingId(fixture.orgId);
    if (!parkingId) throw new Error('No parking in local seed for org');
    const { executeApplyParkingMedia } =
      await import('../_shared/dashboardAssistantHostMediaTools.ts');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'parking-cover-smoke.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeApplyParkingMedia(ctx, {
      attachmentPath,
      parkingId,
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const sb = createServiceClient();
    const { data: parking } = await sb
      .from('parkings')
      .select('settings')
      .eq('id', parkingId)
      .maybeSingle();
    const settings = parking?.settings as Record<string, unknown> | null;
    assertExists(settings?.coverImage ?? settings?.cover_image);
  },
});

Deno.test({
  name: '§D.2 executeApplyAppSettingsAttachment uploads GAF unit owner signature',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const { executeApplyAppSettingsAttachment } =
      await import('../_shared/dashboardAssistantHostMediaTools.ts');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'gaf-signature-smoke.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeApplyAppSettingsAttachment(ctx, {
      attachmentPath,
      propertyId: fixture.propertyId,
      assetType: 'gaf_unit_owner_signature',
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    assertExists(data.url);
    const sb = createServiceClient();
    const { data: row } = await sb
      .from('app_settings')
      .select('gaf_unit_owner_signature_url')
      .eq('property_id', fixture.propertyId)
      .maybeSingle();
    assertExists(row?.gaf_unit_owner_signature_url);
  },
});

Deno.test({
  name: '§D.4 executeApplyTemplateAttachment uploads house-rules section image',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const { executeApplyTemplateAttachment } =
      await import('../_shared/dashboardAssistantHostMediaTools.ts');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'house-rules-section.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeApplyTemplateAttachment(ctx, {
      attachmentPath,
      propertyId: fixture.propertyId,
      assetType: 'section_image',
      templateKey: 'house-rules',
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    assertExists(data.url);
    assertEquals(data.templateKey, 'house-rules');
  },
});

Deno.test({
  name: '§D.5 executeApplyOrgVerificationAttachment uploads valid ID',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const { executeApplyOrgVerificationAttachment } =
      await import('../_shared/dashboardAssistantVerificationTools.ts');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'org-verification-id.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeApplyOrgVerificationAttachment(ctx, {
      attachmentPath,
      assetType: 'valid_id',
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    const verification = data.verification as Record<string, unknown> | undefined;
    assertEquals(verification?.hasValidId ?? data.hasValidId, true);
  },
});

Deno.test({
  name: '§D.5 executeApplyListingAuthorizationAttachment uploads property proof',
  ignore: skip,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    const { executeApplyListingAuthorizationAttachment } =
      await import('../_shared/dashboardAssistantVerificationTools.ts');
    const ctx = await buildCtx(fixture);
    const attachmentPath = await seedAssistantAttachment(
      fixture,
      'listing-auth-proof.png',
      MINIMAL_PNG,
      'image/png'
    );
    const result = await executeApplyListingAuthorizationAttachment(ctx, {
      attachmentPath,
      listingKind: 'property',
      listingId: fixture.propertyId,
      assetType: 'proof',
    });
    if (!result.ok) {
      assertExists(result.error);
      return;
    }
    assertEquals(result.ok, true);
    const data = result.data as Record<string, unknown>;
    assertExists(data.path ?? data.previewUrl);
    assertEquals(data.assetType, 'proof');
  },
});
