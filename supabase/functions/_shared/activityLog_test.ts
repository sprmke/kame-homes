/**
 * activityLog — pure-helper coverage (no Supabase / network).
 * Run: deno test --no-check --allow-env --allow-net supabase/functions/_shared/activityLog_test.ts
 */

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  ACTIVITY_ACTION_CATALOG,
  buildActivityRow,
  buildActorContext,
  diffRecord,
  extractRequestContext,
  logActivity,
  logActivityBatch,
  redactValue,
  truncateIp,
  type LogActivityInput,
} from './activityLog.ts';

const ORG = '00000000-0000-0000-0000-0000000000aa';

Deno.test('truncateIp — /24 for v4, /48 for v6, null for junk', () => {
  assertEquals(truncateIp('203.0.113.42'), '203.0.113.0/24');
  assertEquals(truncateIp('203.0.113.42, 70.1.2.3'), '203.0.113.0/24');
  assertEquals(truncateIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), '2001:0db8:85a3::/48');
  assertEquals(truncateIp('not-an-ip'), null);
  assertEquals(truncateIp(''), null);
  assertEquals(truncateIp(null), null);
});

Deno.test('redactValue — drops secret-ish keys, masks PII', () => {
  assertEquals(redactValue('api_key', 'sk_live_abc123'), '[redacted]');
  assertEquals(redactValue('otp_code', '448291'), '[redacted]');
  assertEquals(redactValue('webhook_signature', 'whsec_x'), '[redacted]');
  assertEquals(redactValue('guest_email', 'juan.delacruz@example.com'), 'j***@e***.com');
  assertStringIncludes(String(redactValue('phone', '+63 917 555 1234')), '1234');
  assert(!String(redactValue('phone', '+63 917 555 1234')).includes('917'));
  assertEquals(redactValue('note', 'plain text'), 'plain text');
});

Deno.test(
  'diffRecord — catches petType (compareFormData does not), redacts, honors include',
  () => {
    const before = { petType: 'cat', notes: 'x', password: 'a' };
    const after = { petType: 'dog', notes: 'x', password: 'b' };

    const all = diffRecord(before, after);
    const fields = all.map((c) => c.field).sort();
    assertEquals(fields, ['password', 'petType']);
    const pet = all.find((c) => c.field === 'petType');
    assertEquals(pet?.from, 'cat');
    assertEquals(pet?.to, 'dog');
    const pw = all.find((c) => c.field === 'password');
    assertEquals(pw?.from, '[redacted]');
    assertEquals(pw?.to, '[redacted]');

    const only = diffRecord(before, after, { include: ['petType'] });
    assertEquals(only.length, 1);
    assertEquals(only[0].field, 'petType');

    assertEquals(diffRecord({ a: 1 }, { a: 1 }).length, 0);
    assertEquals(diffRecord({ o: { x: 1, y: 2 } }, { o: { y: 2, x: 1 } }).length, 0);
  }
);

Deno.test('extractRequestContext — pulls IP prefix / UA / request id from headers', () => {
  const req = new Request('https://x.test/', {
    headers: {
      'cf-connecting-ip': '198.51.100.23',
      'user-agent': 'Mozilla/5.0 test',
      'x-request-id': 'req-42',
    },
  });
  const ctx = extractRequestContext(req);
  assertEquals(ctx.ipPrefix, '198.51.100.0/24');
  assertEquals(ctx.userAgent, 'Mozilla/5.0 test');
  assertEquals(ctx.requestId, 'req-42');

  const none = extractRequestContext(undefined);
  assertEquals(none.ipPrefix, null);
});

Deno.test('buildActorContext — maps access kind → actor type, masks guest identity', () => {
  const owner = buildActorContext('dashboard', {
    orgAccess: {
      user: { id: 'u1', email: 'owner@host.com' },
      accessKind: 'owner',
    } as never,
  });
  assertEquals(owner.actorType, 'org_owner');
  assertEquals(owner.userId, 'u1');

  const member = buildActorContext('dashboard', {
    propertyAccess: {
      user: { id: 'u2', email: 'm@host.com' },
      accessKind: 'member',
      memberId: 'pm1',
    } as never,
  });
  assertEquals(member.actorType, 'team_member');
  assertEquals(member.memberId, 'pm1');

  const assistant = buildActorContext('ai_assistant', {
    assistant: { conversationId: 'conv-9', userId: 'u3' },
  });
  assertEquals(assistant.actorType, 'ai_assistant');
  assertEquals(assistant.source, 'ai_assistant');
  assertEquals(assistant.extraMetadata?.assistant_conversation_id, 'conv-9');

  const guest = buildActorContext('public_form', {
    guest: { email: 'guest@mail.com', name: 'Juan Dela Cruz' },
  });
  assertEquals(guest.actorType, 'guest');
  assertEquals(guest.displayName, 'Juan');
  assert(!String(guest.email).includes('guest@mail.com'));

  const cron = buildActorContext('cron', { cron: 'sd-refund-cron' });
  assertEquals(cron.actorType, 'cron');
  assertEquals(cron.displayName, 'sd-refund-cron');
});

Deno.test('buildActivityRow — catalog defaults, rendered summary, scope inference', () => {
  const row = buildActivityRow({
    action: 'booking.cancelled',
    organizationId: ORG,
    propertyId: 'prop-1',
    actor: buildActorContext('dashboard', {
      propertyAccess: {
        user: { id: 'u2', email: 'm@host.com' },
        accessKind: 'member',
      } as never,
    }),
    targetId: 'bk-1',
    targetLabel: 'Booking #1042 · Juan D.',
  });
  assertEquals(row.category, 'booking');
  assertEquals(row.severity, 'destructive');
  assertEquals(row.target_type, 'booking');
  assertEquals(row.scope, 'property');
  assertEquals(row.organization_id, ORG);
  assertStringIncludes(String(row.summary), 'cancelled');
  assertStringIncludes(String(row.summary), 'Booking #1042');
});

Deno.test('buildActivityRow — severity override + changes cap flag', () => {
  const bigChanges = Array.from({ length: 400 }, (_, i) => ({
    field: `field_${i}`,
    from: 'x'.repeat(60),
    to: 'y'.repeat(60),
  }));
  const row = buildActivityRow({
    action: 'booking.details_edited',
    organizationId: ORG,
    propertyId: 'p1',
    actor: buildActorContext('db_trigger', { system: true }),
    changes: bigChanges,
    metadata: { source_table: 'guest_submissions' },
  });
  const changes = row.changes as unknown[];
  assert(changes.length < bigChanges.length, 'changes should be trimmed');
  assertEquals((row.metadata as Record<string, unknown>).changes_truncated, true);
});

Deno.test('every catalog entry has a valid shape + renders a non-empty summary', () => {
  const categories = new Set([
    'booking',
    'team',
    'settings',
    'pricing',
    'finance',
    'maintenance',
    'marketing',
    'inbox',
    'property',
    'parking',
    'org',
    'plans_billing',
    'verification',
    'integrations',
    'public_pages',
    'guest',
    'security',
    'system',
  ]);
  const severities = new Set(['info', 'notice', 'warning', 'destructive']);
  for (const [action, def] of Object.entries(ACTIVITY_ACTION_CATALOG)) {
    assert(categories.has(def.category), `${action}: bad category ${def.category}`);
    assert(severities.has(def.severity), `${action}: bad severity ${def.severity}`);
    assert(def.targetType.length > 0, `${action}: empty targetType`);
    const s = def.summary({ actorName: 'Alex', targetLabel: null, metadata: {}, changeCount: 2 });
    assert(typeof s === 'string' && s.length > 0, `${action}: empty summary`);
  }
});

Deno.test('marketing generation actions are catalogued', () => {
  const generated = ACTIVITY_ACTION_CATALOG['marketing.image_generated'];
  assertEquals(generated.category, 'marketing');
  assertEquals(generated.targetType, 'marketing_generation');
  assertStringIncludes(
    generated.summary({
      actorName: 'Alex',
      targetLabel: 'Kame Suites',
      metadata: { credits: 45 },
      changeCount: 0,
    }),
    '45 credits'
  );

  const deleted = ACTIVITY_ACTION_CATALOG['marketing.generated_asset_deleted'];
  assertEquals(deleted.severity, 'destructive');
});

Deno.test(
  'logActivity / logActivityBatch — never throw when the client cannot be built',
  async () => {
    const input: LogActivityInput = {
      action: 'system.cron_run',
      organizationId: ORG,
      actor: buildActorContext('cron', { cron: 'x-cron' }),
      metadata: { message: 'did a thing' },
    };
    // No SUPABASE_* env in the test runner → createServiceClient throws inside the
    // swallowing try/catch. The call must still resolve.
    await logActivity(input);
    await logActivity({ ...input, organizationId: '' }); // skipped, no org
    await logActivityBatch([input, input]);
  }
);
