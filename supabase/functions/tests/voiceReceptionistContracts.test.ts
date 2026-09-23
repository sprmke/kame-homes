import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const ROOT = new URL('../', import.meta.url);

async function source(path: string): Promise<string> {
  return await Deno.readTextFile(new URL(path, ROOT));
}

Deno.test('voice guest handlers authenticate and enforce session ownership', async () => {
  const [start, session, tool, end] = await Promise.all([
    source('voice-receptionist-start/index.ts'),
    source('voice-receptionist-session/index.ts'),
    source('voice-receptionist-tool/index.ts'),
    source('voice-receptionist-end/index.ts'),
  ]);

  for (const handler of [start, session, tool, end]) {
    assert(handler.includes("serveAuthenticated('voice-receptionist-"));
  }
  assert(tool.includes('loadVoiceReceptionistSessionForGuest(sessionId, user.id)'));
  assert(tool.includes("session.status !== 'active'"));
  assert(end.includes('loadVoiceReceptionistSessionForEnd(sessionId, user.id)'));
  assert(end.includes('storeClientReportedVoiceTranscript'));
  assert(!end.includes('social_messages'));
});

Deno.test('voice lifecycle migration serializes caps and makes end idempotent', async () => {
  const [migration, durationMigration] = await Promise.all([
    Deno.readTextFile(
      new URL(
        '../../migrations/20261316122400_voice_receptionist_session_hardening.sql',
        import.meta.url
      )
    ),
    Deno.readTextFile(
      new URL(
        '../../migrations/20261316123200_voice_receptionist_connected_duration.sql',
        import.meta.url
      )
    ),
  ]);

  assertEquals((migration.match(/pg_advisory_xact_lock/g) ?? []).length, 2);
  assert(migration.includes('FOR UPDATE'));
  assert(migration.includes("v_session.status IN ('ended', 'failed', 'abandoned', 'expired')"));
  assert(migration.includes('UNIQUE (session_id, sequence)'));
  assert(migration.includes('usage_recorded_at'));
  assert(durationMigration.includes('COALESCE(v_session.connected_at, v_session.started_at)'));
  assert(durationMigration.includes("'provider_go_away'"));
});

Deno.test('voice client and server protocol versions stay in sync', async () => {
  const [server, client] = await Promise.all([
    source('_shared/geminiLiveEphemeral.ts'),
    source('../../ui/src/features/guest/chat/lib/liveVoiceProtocol.ts'),
  ]);
  const protocolPattern = /gemini-live-v1beta-\d{4}-\d{2}/;
  assertEquals(server.match(protocolPattern)?.[0], client.match(protocolPattern)?.[0]);
});

Deno.test('voice legacy backfill preserves the unified platform gates', async () => {
  const [beforeSwitch, beforeFeatures, afterSwitch, afterFeatures] = await Promise.all([
    Deno.readTextFile(
      new URL(
        '../../migrations/20261316122340_voice_receptionist_preserve_platform_switch.sql',
        import.meta.url
      )
    ),
    Deno.readTextFile(
      new URL(
        '../../migrations/20261316122341_voice_receptionist_preserve_feature_allowlist.sql',
        import.meta.url
      )
    ),
    Deno.readTextFile(
      new URL(
        '../../migrations/20261316122351_voice_receptionist_restore_platform_switch.sql',
        import.meta.url
      )
    ),
    Deno.readTextFile(
      new URL(
        '../../migrations/20261316122352_voice_receptionist_restore_feature_allowlist.sql',
        import.meta.url
      )
    ),
  ]);
  assert(beforeSwitch.includes('pre_backfill_platform_enabled'));
  assert(beforeFeatures.includes('pre_backfill_allowed_features'));
  assert(afterSwitch.includes('SET enabled = voice_receptionist_pre_backfill_platform_enabled'));
  assert(
    afterFeatures.includes(
      'SET allowed_features = voice_receptionist_pre_backfill_allowed_features'
    )
  );
});

Deno.test(
  'voice provider and reaper failures remain observable without transcript text',
  async () => {
    const [start, reaper, service] = await Promise.all([
      source('voice-receptionist-start/index.ts'),
      source('voice-receptionist-reaper/index.ts'),
      source('_shared/voiceReceptionistService.ts'),
    ]);

    assert(start.includes("'provider_failed'"));
    assert(start.includes("'gate_denied'"));
    assert(start.includes('mintLatencyMs'));
    assert(reaper.includes("action: 'system.cron_run'"));
    assert(service.includes('classifyVoiceTranscriptSafety'));
    assert(service.includes('safety_flags'));
    assert(service.includes("onConflict: 'session_id,sequence'"));
    assert(service.includes(".neq('transcript_status', 'discarded')"));
  }
);

Deno.test('voice reliability rollup excludes transcript and tool payload data', async () => {
  const migration = await Deno.readTextFile(
    new URL(
      '../../migrations/20261316123400_voice_receptionist_operational_metrics.sql',
      import.meta.url
    )
  );
  assert(migration.includes('PERCENTILE_CONT(0.95)'));
  assert(migration.includes('voice_receptionist_tool_metrics'));
  assert(migration.includes('tool_name TEXT NOT NULL'));
  assert(!migration.includes('tool_args'));
  assert(!migration.includes('tool_result'));
  assert(!migration.includes('transcript_text'));
});
