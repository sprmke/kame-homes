/**
 * Two-way reviews, end to end against the live local stack (`./dev.sh`, functions on :54321):
 * real handlers, real Postgres RPCs, real auth. Seeds a throwaway stay + guest + scoped org
 * member, walks the whole lifecycle, then cleans up. Skipped unless LOCAL_REVIEWS_LIVE=1.
 *
 *   LOCAL_REVIEWS_LIVE=1 bun run test:reviews:live
 *
 * Covers docs/guides/testing/reviews-manual.md: double-blind, publish on both sides, edit lock,
 * guest + host responses, report → super-admin moderation, To write accuracy, org listing scope,
 * booking access tokens. The guest's HTTP submit is CAPTCHA-gated locally (real Turnstile), so
 * the test asserts that block and then writes the guest review through the same service the
 * handler uses. Emails go to Resend's `delivered@resend.dev` test sink.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './_localSupabaseEnv.ts';

const enabled = Deno.env.get('LOCAL_REVIEWS_LIVE') === '1';
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const FIXTURE_PROPERTY_SLUG = Deno.env.get('REVIEWS_LIVE_PROPERTY_SLUG') ?? 'kame-home';

const service = {
  apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

/** Edge secrets the local functions runtime uses (the test mirrors them). */
async function readEdgeEnv(key: string): Promise<string | null> {
  try {
    const text = await Deno.readTextFile(new URL('../../.env.local', import.meta.url).pathname);
    const line = text.split('\n').find((row) => row.startsWith(`${key}=`));
    if (!line) return null;
    return line
      .slice(key.length + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  } catch {
    return null;
  }
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...service, Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function createUser(email: string): Promise<string> {
  const created = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: service,
    body: JSON.stringify({ email, password: `Rv-${crypto.randomUUID()}`, email_confirm: true }),
  }).then((r) => r.json());
  if (!created.id) throw new Error(`create user ${email} failed: ${JSON.stringify(created)}`);
  return created.id as string;
}

async function deleteUser(userId: string): Promise<void> {
  await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: service,
  }).then((r) => r.text());
}

/** Password sign-in is CAPTCHA-protected locally; mint a session from an admin magic link. */
async function sessionToken(email: string): Promise<string> {
  const link = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: service,
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const verified = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }),
  }).then((r) => r.json());
  if (!verified.access_token) throw new Error(`no session for ${email}`);
  return verified.access_token as string;
}

type CallResult = { status: number; json: Record<string, unknown> };

/**
 * Gateway-level failures from a hot-reloading `functions serve` (the edge container restarts on
 * any file change under supabase/functions). Never matches a handler's own error body.
 */
function isGatewayBlip(result: CallResult): boolean {
  if (result.status !== 502 && result.status !== 503 && result.status !== 504) return false;
  const message = String(result.json.message ?? result.json.code ?? result.json.raw ?? '');
  return /name resolution failed|invalid response was received from the upstream|BOOT_ERROR|failed to start|worker|connection refused/i.test(
    message
  );
}

async function call(
  fn: string,
  opts: { token?: string; method?: string; body?: unknown; query?: string } = {}
): Promise<CallResult> {
  for (let attempt = 0; ; attempt++) {
    const result = await callOnce(fn, opts);
    if (!isGatewayBlip(result) || attempt >= 8) return result;
    await new Promise((resolve) => setTimeout(resolve, 2_000 + attempt * 1_000));
  }
}

async function callOnce(
  fn: string,
  opts: { token?: string; method?: string; body?: unknown; query?: string }
): Promise<CallResult> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/functions/v1/${fn}${opts.query ?? ''}`, {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${opts.token ?? ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function data<T>(result: CallResult): T {
  return result.json.data as T;
}

function manilaYmd(offsetDays: number): { mdy: string } {
  const d = new Date(Date.now() + 8 * 3600_000 + offsetDays * 86_400_000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { mdy: `${mm}-${dd}-${d.getUTCFullYear()}` };
}

Deno.test({
  name: 'two-way reviews: full lifecycle against the live local stack',
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const accessSecret = await readEdgeEnv('GUEST_BOOKING_ACCESS_SECRET');
    if (accessSecret) Deno.env.set('GUEST_BOOKING_ACCESS_SECRET', accessSecret);
    const captchaMode = (await readEdgeEnv('CAPTCHA_MODE')) ?? '';
    const superAdminEmail =
      ((await readEdgeEnv('SUPER_ADMIN_EMAILS')) ?? '').split(',')[0]?.trim().toLowerCase() || '';

    const { mintGuestBookingAccessToken } = await import('../_shared/guestBookingAccessToken.ts');
    const { upsertGuestReview } = await import('../_shared/guestReviewService.ts');
    const { ensureReviewWindow } = await import('../_shared/reviewWindow.ts');
    const { publishIfComplete } = await import('../_shared/reviewPublishing.ts');

    const [property] = await rest(
      `properties?select=id,slug,organization_id,organizations(slug,owner_id)&slug=eq.${FIXTURE_PROPERTY_SLUG}`
    );
    assert(
      property?.id,
      `fixture property ${FIXTURE_PROPERTY_SLUG} missing (set REVIEWS_LIVE_PROPERTY_SLUG)`
    );
    const propertyId = property.id as string;
    const orgId = property.organization_id as string;
    const orgSlug = property.organizations.slug as string;
    const owner = await fetch(
      `${LOCAL_SUPABASE_URL}/auth/v1/admin/users/${property.organizations.owner_id}`,
      { headers: service }
    ).then((r) => r.json());
    const ownerEmail = owner.email as string;

    const tag = crypto.randomUUID().slice(0, 8);
    const guestEmail = `delivered+reviews-${tag}@resend.dev`;
    const scopedEmail = `delivered+reviews-scoped-${tag}@resend.dev`;
    const cleanup: Array<() => Promise<void>> = [];
    let bookingId = '';

    try {
      // ── Seed: guest account, completed stay that checked out 2 days ago, scoped org member ──
      const guestUserId = await createUser(guestEmail);
      cleanup.push(() => deleteUser(guestUserId));
      const [booking] = await rest('guest_submissions', {
        method: 'POST',
        body: JSON.stringify({
          property_id: propertyId,
          status: 'COMPLETED',
          booking_source: 'Direct',
          guest_email: guestEmail,
          guest_user_id: guestUserId,
          primary_guest_name: `Review Live ${tag}`,
          guest_facebook_name: `Review Live ${tag}`,
          guest_phone_number: '09170000000',
          guest_address: 'Cebu City',
          check_in_date: manilaYmd(-4).mdy,
          check_out_date: manilaYmd(-2).mdy,
          number_of_nights: 2,
          find_us: 'Facebook',
          owner_contact_number: '09170000000',
          owner_onsite_contact_person: 'Test',
          payment_receipt_url: 'https://example.com/receipt.png',
          tower_and_unit_number: 'T1-0000',
          unit_owner: 'Test',
          security_deposit: 1500,
        }),
      });
      bookingId = booking.id as string;
      cleanup.push(async () => {
        await rest(`review_reports?review_id=in.(${await reviewIds()})`, { method: 'DELETE' });
        await rest(`host_guest_reviews?booking_id=eq.${bookingId}`, { method: 'DELETE' });
        await rest(`guest_reviews?booking_id=eq.${bookingId}`, { method: 'DELETE' });
        await rest(`booking_review_windows?booking_id=eq.${bookingId}`, { method: 'DELETE' });
        await rest(`notifications?booking_id=eq.${bookingId}`, { method: 'DELETE' });
        await rest(`guest_submissions?id=eq.${bookingId}`, { method: 'DELETE' });
      });
      const reviewIds = async () => {
        const g = await rest(`guest_reviews?select=id&booking_id=eq.${bookingId}`);
        const h = await rest(`host_guest_reviews?select=id&booking_id=eq.${bookingId}`);
        const ids = [...g, ...h].map((row: { id: string }) => row.id);
        return ids.length ? ids.join(',') : '00000000-0000-0000-0000-000000000000';
      };

      const scopedUserId = await createUser(scopedEmail);
      cleanup.push(() => deleteUser(scopedUserId));
      const [scopedMember] = await rest('organization_members', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: orgId,
          user_id: scopedUserId,
          role_id: 'ADMIN',
          status: 'active',
          all_listings: false,
          permissions: ['org.reviews:view'],
        }),
      });
      cleanup.push(() =>
        rest(`organization_members?id=eq.${scopedMember.id}`, { method: 'DELETE' }).then(() => {})
      );

      const ownerToken = await sessionToken(ownerEmail);
      const guestToken = await sessionToken(guestEmail);
      const scopedToken = await sessionToken(scopedEmail);
      const access = await mintGuestBookingAccessToken(bookingId);
      const propertyQuery = `property_id=${propertyId}`;

      // ── Guest review page: works for a direct stay with a deposit; tokens are checked ──
      const bootstrap = await call('get-guest-review', {
        query: `?bookingId=${bookingId}&access=${encodeURIComponent(access)}`,
      });
      assertEquals(bootstrap.status, 200, JSON.stringify(bootstrap.json));
      assertEquals(data<{ can_edit_review: boolean }>(bootstrap).can_edit_review, true);
      const forged = await call('get-guest-review', {
        query: `?bookingId=${bookingId}&access=v1.${bookingId}.9999999999999.forged`,
      });
      assertEquals(forged.status, 401, 'a forged access token is rejected');

      // The RFCI → RFCO transition (or the cron fallback) opens the window; the seed skipped it.
      await ensureReviewWindow({
        bookingId,
        propertyId,
        organizationId: orgId,
        checkOutDate: manilaYmd(-2).mdy,
      });

      // ── Guest account: To write lists the stay with an owner-verified access token ──
      const toWrite = await call('list-my-reviews', { token: guestToken, query: '?tab=to_write' });
      assertEquals(toWrite.status, 200, JSON.stringify(toWrite.json));
      const toWriteItem = data<{ items: Array<{ bookingId: string; accessToken: string | null }> }>(
        toWrite
      ).items.find((item) => item.bookingId === bookingId);
      assert(toWriteItem, 'stay is listed in To write');
      assert(toWriteItem.accessToken, 'To write item carries an access token');

      // ── Guest HTTP submit is CAPTCHA-gated when enforced ──
      if (captchaMode === 'enforce') {
        const form = new FormData();
        form.set('bookingId', bookingId);
        form.set('starRating', '5');
        form.set(
          'categoryRatings',
          JSON.stringify({
            cleanliness: 5,
            accuracy: 5,
            check_in: 5,
            communication: 5,
            location: 5,
            value: 5,
          })
        );
        form.set('formLoadedAt', String(Date.now() - 60_000));
        form.set('access', access);
        let status = 0;
        let body: Record<string, unknown> = {};
        for (let attempt = 0; attempt < 8; attempt++) {
          const res = await fetch(`${LOCAL_SUPABASE_URL}/functions/v1/submit-guest-review`, {
            method: 'POST',
            headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
            body: form,
          });
          status = res.status;
          body = await res.json().catch(() => ({}));
          if (!isGatewayBlip({ status, json: body })) break;
          await new Promise((resolve) => setTimeout(resolve, 2_000 + attempt * 1_000));
        }
        assertEquals(status, 400, `no CAPTCHA token -> blocked: ${JSON.stringify(body)}`);
        assertEquals(body.captchaFailed, true);
      }

      // ── Guest review (same service path as submit-guest-review) ──
      const written = await upsertGuestReview({
        propertyId,
        organizationId: orgId,
        bookingId,
        guestUserId,
        starRating: 4,
        reviewText: `Live review ${tag}. Quiet and clean.`,
        categoryRatings: {
          cleanliness: 5,
          accuracy: 4,
          check_in: 4,
          communication: 5,
          location: 4,
          value: 4,
        },
        privateNote: 'Fridge was a bit noisy.',
        feedbackTags: [],
        mediaUrls: [],
        guestDisplayName: `Review Live ${tag}`,
        source: 'guest_review',
      });
      assert(written.ok);
      const firstPublish = await publishIfComplete(bookingId);
      assertEquals(firstPublish.guestPublished, false, 'one side only: nothing publishes');

      // ── Double-blind: host cannot read the unpublished guest review ──
      const received = await call('list-property-reviews', {
        token: ownerToken,
        query: `?tab=received&${propertyQuery}`,
      });
      assertEquals(received.status, 200, JSON.stringify(received.json));
      assertEquals(
        data<{ items: Array<{ bookingId: string }> }>(received).items.some(
          (item) => item.bookingId === bookingId
        ),
        false,
        'unpublished guest review is hidden from the host'
      );
      const hostToWrite = await call('list-property-reviews', {
        token: ownerToken,
        query: `?tab=to_write&${propertyQuery}`,
      });
      const hostToWriteData = data<{
        items: Array<{ bookingId: string }>;
        summary: { dueCount: number };
      }>(hostToWrite);
      assert(hostToWriteData.items.some((item) => item.bookingId === bookingId));
      assert(hostToWriteData.summary.dueCount >= 1);
      const dueBefore = hostToWriteData.summary.dueCount;

      const byYou = await call('list-my-reviews', { token: guestToken, query: '?tab=by_you' });
      const mine = data<{ items: Array<{ bookingId: string; status: string }> }>(byYou).items.find(
        (item) => item.bookingId === bookingId
      );
      assertEquals(mine?.status, 'submitted');

      const screening = await call('get-guest-reputation', {
        token: ownerToken,
        query: `?bookingId=${bookingId}&${propertyQuery}`,
      });
      assertEquals(screening.status, 200, JSON.stringify(screening.json));
      assertEquals(data<{ canHostReview: boolean }>(screening).canHostReview, true);

      // ── Host review: both sides publish together ──
      const hostSubmit = await call('submit-host-guest-review', {
        token: ownerToken,
        query: `?${propertyQuery}`,
        body: {
          bookingId,
          overallRating: 5,
          cleanlinessRating: 5,
          communicationRating: 5,
          houseRulesRating: 5,
          wouldHostAgain: true,
          strengthTags: [],
          issueTags: [],
          reviewText: 'Great guest, left the place tidy.',
          privateNote: '',
          internalNote: `team note ${tag}`,
        },
      });
      assertEquals(hostSubmit.status, 200, JSON.stringify(hostSubmit.json));

      const [guestRow] = await rest(`guest_reviews?select=id,status&booking_id=eq.${bookingId}`);
      const [hostRow] = await rest(
        `host_guest_reviews?select=id,status&booking_id=eq.${bookingId}`
      );
      const [windowRow] = await rest(
        `booking_review_windows?select=closed_reason,published_at&booking_id=eq.${bookingId}`
      );
      assertEquals(guestRow.status, 'published');
      assertEquals(hostRow.status, 'published');
      assertEquals(windowRow.closed_reason, 'published');

      const receivedAfter = await call('list-property-reviews', {
        token: ownerToken,
        query: `?tab=to_write&${propertyQuery}`,
      });
      const afterData = data<{
        items: Array<{ bookingId: string }>;
        summary: { dueCount: number };
      }>(receivedAfter);
      assertEquals(
        afterData.items.some((item) => item.bookingId === bookingId),
        false
      );
      assertEquals(afterData.summary.dueCount, dueBefore - 1, 'To write KPI drops by one');

      // ── Edit lock after publish ──
      const lateEdit = await upsertGuestReview({
        propertyId,
        organizationId: orgId,
        bookingId,
        guestUserId,
        starRating: 1,
        reviewText: 'changed my mind',
        categoryRatings: {
          cleanliness: 1,
          accuracy: 1,
          check_in: 1,
          communication: 1,
          location: 1,
          value: 1,
        },
        privateNote: null,
        feedbackTags: [],
        mediaUrls: [],
        guestDisplayName: null,
        source: 'guest_review',
      });
      assertEquals(lateEdit.ok, false, 'published review cannot be edited');

      // ── Guest sees the published host review, never the internal note ──
      const aboutYou = await call('list-my-reviews', {
        token: guestToken,
        query: '?tab=about_you',
      });
      const aboutItem = data<{ items: Array<Record<string, unknown>> }>(aboutYou).items.find(
        (item) => item.bookingId === bookingId
      );
      assert(aboutItem, 'published host review shows in About you');
      assertEquals(aboutItem.hiddenUntilYouReview, false);
      assertEquals(JSON.stringify(aboutYou.json).includes(`team note ${tag}`), false);

      const guestRespond = await call('respond-to-host-review', {
        token: guestToken,
        body: { bookingId, responseText: 'Thank you, it was a lovely stay.' },
      });
      assertEquals(guestRespond.status, 200, JSON.stringify(guestRespond.json));

      // ── Host response: create then edit ──
      for (const text of ['Thanks for staying!', 'Thanks for staying with us!']) {
        const respond = await call('respond-to-guest-review', {
          token: ownerToken,
          query: `?${propertyQuery}`,
          body: { bookingId, responseText: text },
        });
        assertEquals(respond.status, 200, JSON.stringify(respond.json));
      }

      // ── Reports: hosts report guest reviews only; then super-admin moderation ──
      const ownReport = await call('report-review', {
        token: ownerToken,
        query: `?${propertyQuery}`,
        body: {
          reviewKind: 'host_guest_review',
          reviewId: hostRow.id,
          reason: 'other',
          details: 'Trying to report our own team review of a guest here.',
        },
      });
      assertEquals(ownReport.status, 404);
      const report = await call('report-review', {
        token: ownerToken,
        query: `?${propertyQuery}`,
        body: {
          reviewKind: 'guest_review',
          reviewId: guestRow.id,
          reason: 'irrelevant',
          details: 'Live test report: this text is long enough to pass the gate.',
        },
      });
      assertEquals(report.status, 200, JSON.stringify(report.json));
      const [reportRow] = await rest(
        `review_reports?select=id,status&review_id=eq.${guestRow.id}&status=eq.pending`
      );
      assert(reportRow?.id);

      if (superAdminEmail) {
        let adminToken = await sessionToken(superAdminEmail).catch(() => '');
        if (!adminToken) {
          const createdAdminId = await createUser(superAdminEmail);
          cleanup.push(() => deleteUser(createdAdminId));
          adminToken = await sessionToken(superAdminEmail);
        }
        const uphold = await call('moderate-review-report', {
          token: adminToken,
          body: { reportId: reportRow.id, decision: 'upheld', note: 'live test' },
        });
        assertEquals(uphold.status, 200, JSON.stringify(uphold.json));
        const [removed] = await rest(`guest_reviews?select=status&id=eq.${guestRow.id}`);
        assertEquals(removed.status, 'removed');
        const again = await call('moderate-review-report', {
          token: adminToken,
          body: { reportId: reportRow.id, decision: 'rejected' },
        });
        assertEquals(again.status, 409, 'a decided report cannot be decided twice');
      }

      // ── Org rollup: owner sees the property, a member without assigned listings sees none ──
      const ownerOrg = await call('list-org-reviews', {
        token: ownerToken,
        query: `?org_slug=${orgSlug}`,
      });
      assertEquals(ownerOrg.status, 200, JSON.stringify(ownerOrg.json));
      assert(
        data<{ summary: { properties: Array<{ propertyId: string }> } }>(
          ownerOrg
        ).summary.properties.some((row) => row.propertyId === propertyId)
      );
      const scopedOrg = await call('list-org-reviews', {
        token: scopedToken,
        query: `?org_slug=${orgSlug}&property_id=${propertyId}`,
      });
      assertEquals(scopedOrg.status, 200, JSON.stringify(scopedOrg.json));
      const scopedData = data<{
        summary: { properties: unknown[]; count: number };
        items: unknown[];
      }>(scopedOrg);
      assertEquals(
        scopedData.summary.properties.length,
        0,
        'no assigned listings -> no properties'
      );
      assertEquals(scopedData.items.length, 0, 'property_id cannot widen the visible set');
      assertEquals(scopedData.summary.count, 0);
    } finally {
      for (const step of cleanup.reverse()) {
        try {
          await step();
        } catch (err) {
          console.warn('[reviewsLifecycleLocal] cleanup step failed:', err);
        }
      }
    }
  },
});

async function seedStay(propertyId: string, label: string, checkOutDaysAgo: number) {
  const [row] = await rest('guest_submissions', {
    method: 'POST',
    body: JSON.stringify({
      property_id: propertyId,
      status: 'COMPLETED',
      booking_source: 'Direct',
      guest_email: `delivered+reviews-auto-${label}@resend.dev`,
      primary_guest_name: `Auto Review ${label}`,
      guest_facebook_name: `Auto Review ${label}`,
      guest_phone_number: '09170000000',
      guest_address: 'Cebu City',
      check_in_date: manilaYmd(-checkOutDaysAgo - 2).mdy,
      check_out_date: manilaYmd(-checkOutDaysAgo).mdy,
      number_of_nights: 2,
      find_us: 'Facebook',
      owner_contact_number: '09170000000',
      owner_onsite_contact_person: 'Test',
      payment_receipt_url: 'https://example.com/receipt.png',
      tower_and_unit_number: 'T1-0000',
      unit_owner: 'Test',
      security_deposit: 0,
    }),
  });
  return row.id as string;
}

Deno.test({
  name: 'auto-review (Pro): due stays reviewed, issue stays skipped once, paused and early stays untouched',
  ignore: !enabled,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const cronSecret = (await readEdgeEnv('REVIEW_LIFECYCLE_CRON_SECRET')) ?? '';
    const { ensureReviewWindow } = await import('../_shared/reviewWindow.ts');
    const { upsertGuestReview } = await import('../_shared/guestReviewService.ts');
    const { resolvePropertyEntitlements } = await import('../_shared/planEntitlements.ts');
    const { isFeatureEnabled } = await import('../_shared/planFeatures.ts');

    // A Pro+ property with no open windows and no auto-review rules, so the cron's
    // auto-review pass touches only what this test seeds.
    const candidates = await rest(
      'properties?select=id,organization_id&status=eq.ACTIVE&order=created_at.asc&limit=60'
    );
    let property: { id: string; organization_id: string } | null = null;
    for (const row of candidates as Array<{ id: string; organization_id: string }>) {
      const open = await rest(
        `booking_review_windows?select=booking_id&property_id=eq.${row.id}&published_at=is.null&limit=1`
      );
      const rules = await rest(
        `review_automation_rules?select=property_id&property_id=eq.${row.id}`
      );
      // Open maintenance during the stay is a legitimate skip reason; keep it out of the clean case.
      const maintenance = await rest(
        `maintenance_items?select=id&property_id=eq.${row.id}&completed_at=is.null&limit=1`
      );
      if (open.length || rules.length || maintenance.length) continue;
      const entitlements = await resolvePropertyEntitlements(row.id).catch(() => null);
      if (entitlements && isFeatureEnabled(entitlements, 'reviewAutomation')) {
        property = row;
        break;
      }
    }
    assert(property, 'no idle Pro+ property available locally');
    const propertyId = property.id;
    const orgId = property.organization_id;

    const tag = crypto.randomUUID().slice(0, 8);
    const bookings: string[] = [];
    try {
      const due = await seedStay(propertyId, `${tag}-due`, 5);
      const issue = await seedStay(propertyId, `${tag}-issue`, 5);
      const paused = await seedStay(propertyId, `${tag}-paused`, 5);
      const early = await seedStay(propertyId, `${tag}-early`, 1);
      bookings.push(due, issue, paused, early);

      for (const [bookingId, daysAgo] of [
        [due, 5],
        [issue, 5],
        [paused, 5],
        [early, 1],
      ] as const) {
        await ensureReviewWindow({
          bookingId,
          propertyId,
          organizationId: orgId,
          checkOutDate: manilaYmd(-daysAgo).mdy,
        });
        // Simulate the days since check-out: the window opened `daysAgo` days ago.
        await rest(`booking_review_windows?booking_id=eq.${bookingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            opens_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
            guest_request_sent_at: new Date().toISOString(),
            host_reminder_notified_at: new Date().toISOString(),
          }),
        });
      }
      await rest(`booking_review_windows?booking_id=eq.${paused}`, {
        method: 'PATCH',
        body: JSON.stringify({ auto_review_paused: true }),
      });
      // The guest on `issue` rated the stay 2/5: auto-review must not answer with 5 stars.
      const lowGuest = await upsertGuestReview({
        propertyId,
        organizationId: orgId,
        bookingId: issue,
        guestUserId: null,
        starRating: 2,
        reviewText: 'Not great this time.',
        categoryRatings: {
          cleanliness: 2,
          accuracy: 2,
          check_in: 3,
          communication: 3,
          location: 3,
          value: 2,
        },
        privateNote: null,
        feedbackTags: [],
        mediaUrls: [],
        guestDisplayName: null,
        source: 'guest_review',
      });
      assert(lowGuest.ok);

      await rest('review_automation_rules', {
        method: 'POST',
        body: JSON.stringify({
          property_id: propertyId,
          organization_id: orgId,
          enabled: true,
          delay_days: 3,
          templates: [
            'Thanks {{guest_first_name}}, a pleasure to host at {{property_name}}.',
            '{{guest_first_name}} left {{property_name}} tidy. Welcome back anytime.',
            'Great guest. Easy to host at {{property_name}}.',
          ],
        }),
      });

      const runCron = async () => {
        const res = await fetch(`${LOCAL_SUPABASE_URL}/functions/v1/review-lifecycle-cron`, {
          method: 'POST',
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json',
            ...(cronSecret ? { 'x-review-lifecycle-cron-secret': cronSecret } : {}),
          },
          body: '{}',
        });
        const json = await res.json().catch(() => ({}));
        return { status: res.status, json } as CallResult;
      };
      let first = await runCron();
      for (let attempt = 0; isGatewayBlip(first) && attempt < 8; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2_000 + attempt * 1_000));
        first = await runCron();
      }
      assertEquals(first.status, 200, JSON.stringify(first.json));

      const hostRows = async () =>
        (await rest(
          `host_guest_reviews?select=booking_id,overall_rating,internal_note,author_user_id,status,review_text&booking_id=in.(${bookings.join(',')})`
        )) as Array<{
          booking_id: string;
          overall_rating: number;
          internal_note: string | null;
          author_user_id: string | null;
          status: string;
          review_text: string | null;
        }>;
      const afterFirst = await hostRows();
      const dueReview = afterFirst.find((row) => row.booking_id === due);
      if (!dueReview) {
        const reasons = await rest(
          `booking_review_windows?select=booking_id,auto_review_skipped_reason&booking_id=in.(${bookings.join(',')})`
        );
        throw new Error(
          `due stay not auto-reviewed; cron: ${JSON.stringify(first.json)}; windows: ${JSON.stringify(reasons)}; due=${due}`
        );
      }
      assertEquals(dueReview.overall_rating, 5);
      assertEquals(dueReview.internal_note, 'Auto-review');
      assertEquals(dueReview.author_user_id, null);
      assertEquals(dueReview.status, 'submitted', 'guest has not reviewed: stays hidden');
      assert(!/\{\{|\}\}/.test(dueReview.review_text ?? ''), 'template tokens are filled');
      assertEquals(
        afterFirst.some((row) => row.booking_id === issue),
        false,
        'issue stay skipped'
      );
      assertEquals(
        afterFirst.some((row) => row.booking_id === paused),
        false,
        'paused stay skipped'
      );
      assertEquals(
        afterFirst.some((row) => row.booking_id === early),
        false,
        'not due yet'
      );

      const [issueWindow] = await rest(
        `booking_review_windows?select=auto_review_skipped_reason&booking_id=eq.${issue}`
      );
      assertEquals(issueWindow.auto_review_skipped_reason, 'issue_tags');

      // Second hourly run: nothing is written again and the skip is not re-counted.
      const skippedBefore = Number(first.json.autoReviewsSkipped ?? 0);
      assert(skippedBefore >= 1);
      const second = await runCron();
      assertEquals(second.status, 200, JSON.stringify(second.json));
      assertEquals(Number(second.json.autoReviewsSkipped ?? 0), 0, 'skip is stored, not recounted');
      assertEquals((await hostRows()).length, afterFirst.length);
    } finally {
      await rest(`review_automation_rules?property_id=eq.${propertyId}`, { method: 'DELETE' });
      if (bookings.length) {
        const ids = bookings.join(',');
        await rest(`host_guest_reviews?booking_id=in.(${ids})`, { method: 'DELETE' });
        await rest(`guest_reviews?booking_id=in.(${ids})`, { method: 'DELETE' });
        await rest(`booking_review_windows?booking_id=in.(${ids})`, { method: 'DELETE' });
        await rest(`notifications?booking_id=in.(${ids})`, { method: 'DELETE' });
        await rest(`guest_submissions?id=in.(${ids})`, { method: 'DELETE' });
      }
    }
  },
});
