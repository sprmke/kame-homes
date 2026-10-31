-- Idempotency store for offline-outbox replays.
-- Plan: docs/workflow/in-progress/pwa-installable-offline-push.md (Phase 4)
--
-- One row per `Idempotency-Key`. `_shared/idempotency.ts#withIdempotency` claims
-- the key (status 0), runs the handler once, then stores the response so any
-- replay returns it verbatim without re-running side effects.
-- `status = 0` means "in flight". TTL-swept opportunistically by the wrapper.

CREATE TABLE IF NOT EXISTS public.request_idempotency (
  key TEXT PRIMARY KEY,
  status INTEGER NOT NULL DEFAULT 0,
  body TEXT,
  content_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_request_idempotency_expires
  ON public.request_idempotency (expires_at);

COMMENT ON TABLE public.request_idempotency IS
  'At-most-once execution for edge handlers replayed by the PWA offline outbox. Rows expire after ~48h.';

ALTER TABLE public.request_idempotency ENABLE ROW LEVEL SECURITY;
-- Service role only — never touched directly by clients.
GRANT ALL ON public.request_idempotency TO service_role;
