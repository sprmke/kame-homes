import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  DEFAULT_USER_UI_PREFERENCES,
  mapUserUiPreferencesRow,
  parseUserUiPreferencesPatch,
} from './userUiPreferences.ts';

Deno.test('parseUserUiPreferencesPatch accepts both modes', () => {
  assertEquals(parseUserUiPreferencesPatch({ dashboardMode: 'ai' }), {
    ok: true,
    patch: { dashboardMode: 'ai' },
  });
  assertEquals(parseUserUiPreferencesPatch({ dashboardMode: 'advanced' }), {
    ok: true,
    patch: { dashboardMode: 'advanced' },
  });
});

Deno.test('parseUserUiPreferencesPatch rejects bad values and unknown keys', () => {
  assertEquals(parseUserUiPreferencesPatch({ dashboardMode: 'chat' }).ok, false);
  assertEquals(parseUserUiPreferencesPatch({}).ok, false);
  assertEquals(parseUserUiPreferencesPatch({ dashboardMode: 'ai', theme: 'dark' }).ok, false);
});

Deno.test('mapUserUiPreferencesRow defaults to advanced', () => {
  assertEquals(mapUserUiPreferencesRow(null), DEFAULT_USER_UI_PREFERENCES);
  assertEquals(mapUserUiPreferencesRow({ dashboard_mode: 'nope' }).dashboardMode, 'advanced');
  assertEquals(
    mapUserUiPreferencesRow({ dashboard_mode: 'ai', updated_at: '2026-09-28T00:00:00Z' }),
    { dashboardMode: 'ai', updatedAt: '2026-09-28T00:00:00Z' }
  );
});
