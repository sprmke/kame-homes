/**
 * Shared helpers for the live agentic-AI scenario tests. They talk to the local stack only
 * (`./dev.sh`, functions on :54321) and never to a hosted project. Prepare the data with
 * `scripts/dev/seed-agent-e2e.sql`.
 */
import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const JWT_SECRET =
  Deno.env.get('JWT_SECRET')?.trim() || 'super-secret-jwt-token-with-at-least-32-characters-long';
export const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const serviceHeaders = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

function b64(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function mintJwt(userId: string, email: string): Promise<string> {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64(
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
  return `${header}.${body}.${b64(new Uint8Array(sig))}`;
}

export async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders, Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

export type AgentFixture = {
  orgId: string;
  orgSlug: string;
  propertyId: string;
  userId: string;
  jwt: string;
};

export async function loadAgentFixture(): Promise<AgentFixture> {
  const [org] = await rest<Array<{ id: string; slug: string; owner_id: string }>>(
    'organizations?slug=eq.kame-homes&select=id,slug,owner_id'
  );
  if (!org) throw new Error('Local org kame-homes missing. Run db:reset with the demo seed.');
  const [property] = await rest<Array<{ id: string }>>(
    `properties?organization_id=eq.${org.id}&slug=eq.kame-home&select=id`
  );
  if (!property) throw new Error('Local property kame-home missing.');
  const user = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${org.owner_id}`, {
    headers: serviceHeaders,
  }).then((r) => r.json());
  if (!user?.email) {
    throw new Error('Owner not readable. Run scripts/dev/seed-agent-e2e.sql against the local DB.');
  }
  return {
    orgId: org.id,
    orgSlug: org.slug,
    propertyId: property.id,
    userId: org.owner_id,
    jwt: await mintJwt(org.owner_id, user.email),
  };
}

/**
 * Clears the per-user rate-limit counters and today's assistant usage on the LOCAL database so
 * repeated scenario runs do not trip the 30-requests-per-10-minutes guard or the daily message
 * cap and the AI platform call cap. The limits themselves stay on; only the counters are reset.
 */
export async function resetLocalLimits(
  fx: Pick<AgentFixture, 'userId' | 'orgId'> & { propertyId?: string }
): Promise<void> {
  if (!LOCAL_SUPABASE_URL.startsWith('http://127.0.0.1')) {
    throw new Error('Refusing to reset limits on a non-local database');
  }
  const del = (path: string) =>
    fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers: serviceHeaders });
  await del(`request_rate_limits?identity=ilike.*${fx.userId}*`);
  await del(`ai_dashboard_assistant_usage_daily?organization_id=eq.${fx.orgId}`);
  await del(`ai_platform_usage_daily?organization_id=eq.${fx.orgId}`);
  await del(`ai_platform_property_usage_daily?organization_id=eq.${fx.orgId}`);
}

export type ChatBlock = { type: string; [key: string]: unknown };

export type AssistantReply = {
  status: number;
  body: Record<string, unknown> | null;
  blocks: ChatBlock[];
  text: string;
  conversationId: string | null;
  toolNames: string[];
};

export function blocksText(blocks: ChatBlock[]): string {
  return blocks
    .map((b) =>
      typeof b.text === 'string' ? b.text : typeof b.summary === 'string' ? b.summary : ''
    )
    .filter(Boolean)
    .join('\n');
}

export async function askAssistant(
  fx: AgentFixture,
  message: string,
  options: {
    conversationId?: string | null;
    pageContext?: Record<string, unknown>;
    jwt?: string;
  } = {}
): Promise<AssistantReply> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/functions/v1/dashboard-assistant-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.jwt ?? fx.jwt}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orgSlug: fx.orgSlug,
      pageContext: options.pageContext ?? { propertyId: fx.propertyId },
      conversationId: options.conversationId ?? undefined,
      message,
      stream: false,
    }),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const data = (body?.data ?? null) as Record<string, unknown> | null;
  const blocks = ((data?.blocks as ChatBlock[] | undefined) ?? []) as ChatBlock[];
  const timing = (data?.timing ?? {}) as { tools_ms?: Array<{ name: string }> };
  return {
    status: res.status,
    body,
    blocks,
    text: blocksText(blocks),
    conversationId: (data?.conversationId as string | undefined) ?? null,
    toolNames: (timing.tools_ms ?? []).map((t) => t.name),
  };
}

export function blocksOfType(reply: AssistantReply, type: string): ChatBlock[] {
  return reply.blocks.filter((b) => b.type === type);
}
