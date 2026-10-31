import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { supabaseDashboardUrl, supabaseProjectRef } from './types.ts';

const getter = (env: Record<string, string>) => (key: string) => env[key];

Deno.test('supabaseProjectRef', () => {
  assertEquals(
    supabaseProjectRef(getter({ SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' })),
    'abcdefghijklmnopqrst'
  );
  assertEquals(
    supabaseProjectRef(
      getter({
        SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
        SUPABASE_PROJECT_REF: 'x',
      })
    ),
    'x'
  );
  assertEquals(supabaseProjectRef(getter({ SUPABASE_URL: 'http://127.0.0.1:54321' })), null);
  assertEquals(supabaseProjectRef(getter({})), null);
});

Deno.test('supabaseDashboardUrl', () => {
  assertEquals(supabaseDashboardUrl(null, 'functions/secrets'), undefined);
  assertEquals(
    supabaseDashboardUrl('ref', 'database/extensions'),
    'https://supabase.com/dashboard/project/ref/database/extensions'
  );
});
