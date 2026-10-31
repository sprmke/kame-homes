/**
 * Live Gemini end-to-end smoke for attachment-parity manual guide §11–13 (API path).
 * Requires local Supabase + GEMINI_API_KEY(S) in supabase/.env.local.
 *
 * Run: LIVE_ASSISTANT_GEMINI=1 bun run test:assistant-parity:live
 * Skip: default (not included in CI / normal parity run).
 */
import './_localSupabaseEnv.ts';
import {
  assertEquals,
  assertExists,
  assertMatch,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  setDashboardAssistantGlobalSettings,
  upsertDashboardAssistantOrgSettings,
} from '../_shared/dashboardAssistantSettings.ts';
import {
  setAiPlatformGlobalSettings,
  upsertAiPlatformOrgSettings,
} from '../_shared/aiUsageService.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';

const JWT_SECRET =
  Deno.env.get('JWT_SECRET')?.trim() || 'super-secret-jwt-token-with-at-least-32-characters-long';

const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY')?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function functionsBaseUrl(): string {
  const raw = Deno.env.get('SUPABASE_URL')?.trim() || 'http://127.0.0.1:54321';
  return raw.replace(/\/functions\/v1\/?$/, '');
}

const MINIMAL_PDF = new TextEncoder().encode(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF
`
);

const MINIMAL_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

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
  orgSlug: string;
  propertyId: string;
  userId: string;
  userEmail: string;
};

async function loadFixture(): Promise<Fixture | null> {
  const sb = createServiceClient();
  const { data: org } = await sb
    .from('organizations')
    .select('id, slug, owner_id')
    .eq('slug', 'kame-homes')
    .maybeSingle();
  if (!org?.id || !org.owner_id || !org.slug) return null;

  const { data: property } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', org.id)
    .eq('slug', 'kame-home')
    .maybeSingle();
  if (!property?.id) return null;

  const { data: owner } = await sb.auth.admin.getUserById(org.owner_id);
  if (!owner.user?.email) return null;

  return {
    orgId: org.id,
    orgSlug: org.slug,
    propertyId: property.id,
    userId: org.owner_id,
    userEmail: owner.user.email,
  };
}

async function ensureProPlanWithAssistant(fixture: Fixture): Promise<void> {
  const sb = createServiceClient();
  const { data: proPlan } = await sb
    .from('pricing_plans')
    .select('id')
    .eq('code', 'pro')
    .maybeSingle();
  if (!proPlan?.id) throw new Error('Pro pricing plan missing from local seed');

  const { data: slot } = await sb
    .from('org_subscription_properties')
    .select('org_subscription_id')
    .eq('property_id', fixture.propertyId)
    .maybeSingle();
  if (!slot?.org_subscription_id) throw new Error('No org subscription slot for fixture property');

  const { error } = await sb
    .from('org_subscriptions')
    .update({ plan_id: proPlan.id, status: 'active' })
    .eq('id', slot.org_subscription_id);
  if (error) throw new Error(`Failed to upgrade org plan: ${error.message}`);
}

async function ensureAssistantEnabled(fixture: Fixture): Promise<void> {
  const sb = createServiceClient();
  await setAiPlatformGlobalSettings({
    enabled: true,
    enforceQuotas: false,
    allowedFeatures: ['dashboard_assistant'],
    updatedBy: fixture.userId,
  });
  await upsertAiPlatformOrgSettings({
    organizationId: fixture.orgId,
    enabled: true,
    dailyCreditLimit: 10_000,
    monthlyCreditLimit: 100_000,
    updatedBy: fixture.userId,
  });
  await sb.from('ai_platform_usage_daily').delete().eq('organization_id', fixture.orgId);
  await sb.from('ai_dashboard_assistant_usage_daily').delete().eq('organization_id', fixture.orgId);
  await setDashboardAssistantGlobalSettings({ enabled: true, updatedBy: fixture.userId });
  await upsertDashboardAssistantOrgSettings({
    organizationId: fixture.orgId,
    enabled: true,
    disabledPropertyIds: [],
    dailyMessageLimit: 100,
    monthlyMessageLimit: 2000,
    updatedBy: fixture.userId,
  });
}

type ChatBlock = Record<string, unknown>;

type ChatResponse = {
  conversationId?: string;
  blocks?: ChatBlock[];
  upgradeHook?: boolean;
  error?: string;
};

async function postAssistantChat(
  jwt: string,
  body: Record<string, unknown>
): Promise<ChatResponse> {
  const res = await fetch(`${functionsBaseUrl()}/functions/v1/dashboard-assistant-chat`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.success === false) {
    throw new Error(String(json.error ?? json.message ?? res.statusText));
  }
  const payload = (json.data ?? json) as ChatResponse;
  return payload;
}

async function postAssistantConfirm(
  jwt: string,
  actionId: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${functionsBaseUrl()}/functions/v1/dashboard-assistant-confirm`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actionId, confirm: true }),
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.success === false) {
    throw new Error(String(json.error ?? json.message ?? res.statusText));
  }
  return (json.data ?? json) as Record<string, unknown>;
}

function blocksText(blocks: ChatBlock[]): string {
  return JSON.stringify(blocks).toLowerCase();
}

function findActionConfirmation(blocks: ChatBlock[]): ChatBlock | null {
  return blocks.find((b) => b.type === 'action_confirmation' && b.status === 'proposed') ?? null;
}

const skip =
  Deno.env.get('LIVE_ASSISTANT_GEMINI') !== '1' ||
  Deno.env.get('SKIP_ASSISTANT_INTEGRATION') === '1';

Deno.test({
  name: 'live §12.3 get_org_plan_snapshot via real Gemini chat',
  ignore: skip,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    await ensureProPlanWithAssistant(fixture);
    await ensureAssistantEnabled(fixture);
    const jwt = await mintUserJwt(fixture.userId, fixture.userEmail);

    const result = await postAssistantChat(jwt, {
      orgSlug: fixture.orgSlug,
      pageContext: { propertyId: fixture.propertyId },
      message: 'What plan are we on and which features does it include?',
    });
    assertExists(result.conversationId);
    assertEquals(result.upgradeHook, undefined);
    const blocks = result.blocks ?? [];
    assertEquals(blocks.length > 0, true);
    const text = blocksText(blocks).toLowerCase();
    assertMatch(text, /pro|plan|subscription|feature/i);
  },
});

Deno.test({
  name: 'live §13.2 guide_import_bookings deep-link via real Gemini chat',
  ignore: skip,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');
    await ensureProPlanWithAssistant(fixture);
    await ensureAssistantEnabled(fixture);
    const jwt = await mintUserJwt(fixture.userId, fixture.userEmail);

    const result = await postAssistantChat(jwt, {
      orgSlug: fixture.orgSlug,
      pageContext: { propertyId: fixture.propertyId },
      message: 'How do I import bookings from a spreadsheet?',
    });
    const blocks = result.blocks ?? [];
    const text = blocksText(blocks);
    assertMatch(text, /import|bookings|spreadsheet|csv/i);
    assertMatch(text, /cannot import|not available in chat|import ui|bookings/i);
  },
});

Deno.test({
  name: 'live §11.3 org logo apply from chat PNG (chat → confirm)',
  ignore: skip,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const fixture = await loadFixture();
    if (!fixture) throw new Error('Local fixture missing');

    await ensureProPlanWithAssistant(fixture);
    await ensureAssistantEnabled(fixture);
    const jwt = await mintUserJwt(fixture.userId, fixture.userEmail);

    const chat = await postAssistantChat(jwt, {
      orgSlug: fixture.orgSlug,
      pageContext: { propertyId: fixture.propertyId },
      message: 'Set the attached image as our organization team logo.',
      attachments: [
        {
          name: 'live-org-logo.png',
          mimeType: 'image/png',
          dataBase64: bytesToBase64(MINIMAL_PNG),
        },
      ],
    });

    const blocks = chat.blocks ?? [];
    const proposal = findActionConfirmation(blocks);
    assertExists(
      proposal,
      `Expected Tier-2 org logo proposal; got: ${JSON.stringify(blocks).slice(0, 800)}`
    );
    assertEquals(proposal.toolName, 'propose_apply_org_logo');

    const actionId = String(proposal.actionId ?? '');
    assertExists(actionId);
    await postAssistantConfirm(jwt, actionId);

    const sb = createServiceClient();
    const { data: settings } = await sb
      .from('org_settings')
      .select('email_logo_url')
      .eq('organization_id', fixture.orgId)
      .maybeSingle();
    assertExists(settings?.email_logo_url);
  },
});
