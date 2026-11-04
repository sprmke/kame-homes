import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { resolveDashboardAssistantKillSwitch } from './dashboardAssistantSettings.ts';

Deno.test('resolveDashboardAssistantKillSwitch — org override wins when set', () => {
  assertEquals(resolveDashboardAssistantKillSwitch(true, false), false);
  assertEquals(resolveDashboardAssistantKillSwitch(false, true), true);
});

Deno.test('resolveDashboardAssistantKillSwitch — null override inherits the global value', () => {
  assertEquals(resolveDashboardAssistantKillSwitch(true, null), true);
  assertEquals(resolveDashboardAssistantKillSwitch(false, null), false);
});
