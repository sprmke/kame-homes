/**
 * Idempotency wrapper for edge handlers that the offline outbox may replay.
 * Plan: docs/workflow/in-progress/pwa-installable-offline-push.md (Phase 4)
 *
 * A request carrying an `Idempotency-Key` header runs its handler **at most
 * once**. A replay of the same key returns the first response verbatim without
 * re-running side effects (booking transitions, guest message sends, …).
 *
 * Claim-first: we insert a placeholder row before running the handler, so a
 * concurrent replay blocks on the unique key and waits for the stored result
 * rather than double-executing.
 *
 * Requires table `request_idempotency` (20261303120200_request_idempotency.sql).
 * If the table is absent (older env), the wrapper degrades to a plain pass-through.
 */
import { createServiceClient } from './orgAuth.ts';

const TTL_MS = 48 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 400;
// Long enough to cover the slowest wrapped handler (a booking transition with
// many side effects + emails) before a concurrent replay gives up and re-runs.
const POLL_TIMEOUT_MS = 30_000;

// deno-lint-ignore no-explicit-any
type EdgeHandler = (req: Request, ...rest: any[]) => Promise<Response>;

function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

async function rebuildResponse(row: {
  status: number;
  body: string | null;
  content_type: string | null;
}): Promise<Response> {
  return new Response(row.body ?? '', {
    status: row.status,
    headers: { 'Content-Type': row.content_type ?? 'application/json' },
  });
}

export function withIdempotency<H extends EdgeHandler>(handler: H): H {
  // deno-lint-ignore no-explicit-any
  const wrapped = async (req: Request, ...rest: any[]): Promise<Response> => {
    const key = req.headers.get('idempotency-key')?.trim();
    if (!key) return handler(req, ...rest);

    const sb = createServiceClient();

    // Opportunistic TTL sweep (~2% of keyed requests) — avoids a dedicated cron.
    if (Math.random() < 0.02) {
      await sb
        .from('request_idempotency')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .then(
          () => {},
          () => {}
        );
    }

    // Claim the key.
    const claim = await sb
      .from('request_idempotency')
      .insert({ key, status: 0, body: null, content_type: null, expires_at: isoIn(TTL_MS) })
      .select('key')
      .maybeSingle();

    if (claim.error) {
      // 23505 → someone already claimed/completed this key. Table missing → 42P01.
      if (claim.error.code === '42P01') return handler(req, ...rest);
      if (claim.error.code !== '23505') {
        console.error('[idempotency] claim failed:', claim.error.message);
        return handler(req, ...rest);
      }
      // Wait for the winning request to store its response.
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        const { data } = await sb
          .from('request_idempotency')
          .select('status, body, content_type')
          .eq('key', key)
          .maybeSingle();
        if (data && data.status !== 0) return rebuildResponse(data);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      // Peer never finished — fall through and run it ourselves.
      return handler(req, ...rest);
    }

    // We own the key: run the handler, then persist the outcome.
    try {
      const res = await handler(req, ...rest);
      if (res.status >= 200 && res.status < 300) {
        const clone = res.clone();
        const body = await clone.text();
        await sb
          .from('request_idempotency')
          .update({
            status: res.status,
            body,
            content_type: clone.headers.get('content-type') ?? 'application/json',
            expires_at: isoIn(TTL_MS),
          })
          .eq('key', key)
          .then(
            () => {},
            () => {}
          );
      } else {
        // Non-2xx: release the claim so a genuine retry can run again.
        await sb
          .from('request_idempotency')
          .delete()
          .eq('key', key)
          .then(
            () => {},
            () => {}
          );
      }
      return res;
    } catch (err) {
      await sb
        .from('request_idempotency')
        .delete()
        .eq('key', key)
        .then(
          () => {},
          () => {}
        );
      throw err;
    }
  };

  return wrapped as H;
}
