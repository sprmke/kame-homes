import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { shouldInlineBackgroundTasks } from './backgroundTask.ts';

function withEnv(patch: Record<string, string | null>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) prev[key] = Deno.env.get(key);
  try {
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value == null) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

Deno.test('shouldInlineBackgroundTasks — API_URL loopback after SUPABASE_URL is stripped', () => {
  withEnv(
    {
      EDGE_INLINE_BACKGROUND_TASKS: null,
      SUPABASE_URL: null,
      API_URL: 'http://127.0.0.1:54321',
    },
    () => assertEquals(shouldInlineBackgroundTasks(), true)
  );
});

Deno.test('shouldInlineBackgroundTasks — hosted URL uses waitUntil unless forced', () => {
  withEnv(
    {
      EDGE_INLINE_BACKGROUND_TASKS: null,
      SUPABASE_URL: 'https://example.supabase.co',
      API_URL: 'https://example.supabase.co',
    },
    () => assertEquals(shouldInlineBackgroundTasks(), false)
  );
  withEnv(
    {
      EDGE_INLINE_BACKGROUND_TASKS: '1',
      SUPABASE_URL: 'https://example.supabase.co',
      API_URL: 'https://example.supabase.co',
    },
    () => assertEquals(shouldInlineBackgroundTasks(), true)
  );
});
