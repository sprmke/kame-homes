/**
 * Table-driven auth-rejection harness (doc 29 Phase 29.2 — first slice).
 *
 * Doc 21's static sweep (audit-auth-matrix.mjs) confirmed "missing authentication is
 * structurally impossible" for any serve*-wrapped function by reading serveEdge.ts's
 * source; this test proves the same claim at runtime instead of by inspection, against
 * the three JWT-checking auth verifiers every admin/authenticated/super-admin function
 * routes through before any handler logic runs.
 *
 * Deliberately does NOT import serveEdge.ts — it calls `serve()` from Deno's std http
 * server at module scope (binds a port), which is why none of the 7 existing handler
 * tests import it either. Testing the verifiers directly covers every function that
 * uses them without that problem, and without needing a live Supabase connection: each
 * verifier throws on a missing/malformed Authorization header *before* it reaches
 * createServiceClient() (traced by hand in auth.ts / orgAuth.ts / superAdminAuth.ts),
 * so these cases never touch the network.
 *
 * Full 300-function per-handler coverage (request shape, business-logic validation,
 * per-permission-leaf cases) is future work — this is the wrapper-level slice doc 29.2
 * describes as the higher-leverage alternative to writing 300 tests by hand.
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { verifyAdminJwt } from '../_shared/auth.ts';
import { verifyAuthenticatedUser } from '../_shared/orgAuth.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

type Verifier = (req: Request) => Promise<unknown>;

const VERIFIERS: Array<{ name: string; verify: Verifier }> = [
  { name: 'verifyAdminJwt (serveAdmin)', verify: verifyAdminJwt },
  { name: 'verifyAuthenticatedUser (serveAuthenticated)', verify: verifyAuthenticatedUser },
  { name: 'verifySuperAdminJwt (serveSuperAdmin)', verify: verifySuperAdminJwt },
];

const BAD_AUTH_CASES: Array<{ name: string; headers: HeadersInit }> = [
  { name: 'no Authorization header', headers: {} },
  { name: 'empty Authorization header', headers: { Authorization: '' } },
  { name: 'non-Bearer scheme', headers: { Authorization: 'Basic dXNlcjpwYXNz' } },
  { name: 'Bearer with no token', headers: { Authorization: 'Bearer ' } },
  { name: 'Bearer with only whitespace', headers: { Authorization: 'Bearer    ' } },
];

for (const { name: verifierName, verify } of VERIFIERS) {
  for (const { name: caseName, headers } of BAD_AUTH_CASES) {
    Deno.test(`${verifierName} rejects: ${caseName}`, async () => {
      const req = new Request('https://example.com/fn', { headers });
      const thrown = await assertRejects(() => verify(req));
      // Every verifier throws a Response (not an Error) on auth failure — the
      // serve* wrapper's catch block re-throws it as-is so handleEdgeError can
      // serialize it. A verifier that ever threw a plain Error here would crash
      // the wrapper's catch block instead of returning a clean 401 (doc 21's
      // "missing authentication is structurally impossible" claim depends on
      // this always being a Response, never an uncaught throw).
      assertEquals(thrown instanceof Response, true);
      const status = (thrown as Response).status;
      assertEquals(status === 401 || status === 403, true, `expected 401/403, got ${status}`);
    });
  }
}
