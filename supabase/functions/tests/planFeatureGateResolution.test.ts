import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  PlanFeatureRequiredError,
  requireOrgFeature,
  requirePropertyFeature,
} from '../_shared/planEntitlements.ts';
import {
  DEFAULT_PLAN_FEATURES,
  type PlanFeatureKey,
  type PlanFeatures,
} from '../_shared/planFeatures.ts';
import {
  loadGuestStayGuideByToken,
  propertyHasStayGuideAccess,
  STAY_GUIDE_PLAN_ACCESS_DENIED,
} from '../_shared/guestStayGuide.ts';

type Stub = {
  /** Plan features of the org subscription; null means the property is not enrolled. */
  features: Partial<PlanFeatures> | null;
  status?: string;
  overrides?: Record<string, unknown> | null;
  /** Row returned for `guest_submissions` lookups (stay guide token reads). */
  guestSubmission?: Record<string, unknown> | null;
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const planRow = (code: string, features: unknown) => ({
  id: `plan-${code}`,
  code,
  name: code,
  pricing_model: 'subscription',
  price_php: 0,
  discount_percent: 0,
  volume_discount_tiers: null,
  volume_ramp_floor_php: null,
  volume_ramp_at_count: null,
  commission_rate_percent: null,
  features,
  is_default: code === 'free',
});

/** Fake PostgREST: answers the three tables the entitlement resolver reads. */
async function withStubbedDb(stub: Stub, run: () => Promise<void>) {
  const realFetch = globalThis.fetch;
  Deno.env.set('SUPABASE_URL', 'http://stub.local');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'stub-key');
  globalThis.fetch = (input: Request | URL | string) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    );
    if (url.pathname.endsWith('/org_subscription_properties')) {
      return Promise.resolve(json(stub.features ? { org_subscription_id: 'sub-1' } : null));
    }
    if (url.pathname.endsWith('/org_subscriptions')) {
      return Promise.resolve(
        stub.features
          ? json({
              id: 'sub-1',
              organization_id: 'org-1',
              plan_id: 'plan-x',
              pricing_model: 'subscription',
              price_php_snapshot: 0,
              status: stub.status ?? 'active',
              current_period_start: null,
              current_period_end: null,
              feature_overrides: stub.overrides ?? null,
              pricing_plans: planRow('paid', { ...DEFAULT_PLAN_FEATURES, ...stub.features }),
            })
          : json(null)
      );
    }
    if (url.pathname.endsWith('/guest_submissions')) {
      return Promise.resolve(json(stub.guestSubmission ?? null));
    }
    if (url.pathname.endsWith('/pricing_plans')) {
      return Promise.resolve(json(planRow('free', DEFAULT_PLAN_FEATURES)));
    }
    return Promise.resolve(new Response('unexpected ' + url.pathname, { status: 500 }));
  };
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
}

const BOOLEAN_KEYS = (Object.keys(DEFAULT_PLAN_FEATURES) as PlanFeatureKey[]).filter((k) =>
  typeof DEFAULT_PLAN_FEATURES[k] === 'object'
    ? typeof (DEFAULT_PLAN_FEATURES[k] as { enabled?: unknown }).enabled === 'boolean'
    : typeof DEFAULT_PLAN_FEATURES[k] === 'boolean'
);

const featuresWith = (key: PlanFeatureKey, on: boolean): Partial<PlanFeatures> => {
  const base = DEFAULT_PLAN_FEATURES[key];
  return {
    [key]: typeof base === 'object' ? { ...(base as object), enabled: on } : on,
  } as Partial<PlanFeatures>;
};

Deno.test('every boolean plan key is exercised', () => {
  assertEquals(BOOLEAN_KEYS.length >= 20, true, String(BOOLEAN_KEYS.length));
});

Deno.test(
  'requirePropertyFeature allows a key the plan turns on and denies it when off',
  async () => {
    for (const key of BOOLEAN_KEYS) {
      await withStubbedDb({ features: featuresWith(key, true) }, async () => {
        await requirePropertyFeature('prop-1', key);
      });
      await withStubbedDb({ features: featuresWith(key, false) }, async () => {
        const err = await assertRejects(
          () => requirePropertyFeature('prop-1', key),
          PlanFeatureRequiredError
        );
        assertEquals((err as PlanFeatureRequiredError).feature, key);
      });
    }
  }
);

Deno.test(
  'a property that is not enrolled resolves to the Free plan and is denied paid keys',
  async () => {
    await withStubbedDb({ features: null }, async () => {
      await assertRejects(
        () => requirePropertyFeature('prop-1', 'smartPricing'),
        PlanFeatureRequiredError
      );
    });
  }
);

Deno.test('a suspended subscription is denied even a key its plan includes', async () => {
  await withStubbedDb(
    { features: featuresWith('smartPricing', true), status: 'suspended' },
    async () => {
      const err = await assertRejects(
        () => requirePropertyFeature('prop-1', 'smartPricing'),
        PlanFeatureRequiredError
      );
      assertEquals((err as PlanFeatureRequiredError).message.includes('suspended'), true);
    }
  );
});

Deno.test('past_due and trialing subscriptions keep their paid features', async () => {
  for (const status of ['past_due', 'trialing']) {
    await withStubbedDb({ features: featuresWith('smartPricing', true), status }, async () => {
      await requirePropertyFeature('prop-1', 'smartPricing');
    });
  }
});

Deno.test('requireOrgFeature follows the org subscription and falls back to Free', async () => {
  await withStubbedDb({ features: featuresWith('financeReporting', true) }, async () => {
    await requireOrgFeature('org-1', 'financeReporting');
  });
  await withStubbedDb({ features: featuresWith('financeReporting', false) }, async () => {
    await assertRejects(
      () => requireOrgFeature('org-1', 'financeReporting'),
      PlanFeatureRequiredError
    );
  });
  await withStubbedDb({ features: null }, async () => {
    await assertRejects(
      () => requireOrgFeature('org-1', 'financeReporting'),
      PlanFeatureRequiredError
    );
  });
});

Deno.test('stay guide access follows propertyShowcase (Pro+)', async () => {
  await withStubbedDb({ features: featuresWith('propertyShowcase', true) }, async () => {
    assertEquals(await propertyHasStayGuideAccess('prop-1'), true);
  });
  await withStubbedDb({ features: featuresWith('propertyShowcase', false) }, async () => {
    assertEquals(await propertyHasStayGuideAccess('prop-1'), false);
  });
  await withStubbedDb({ features: null }, async () => {
    assertEquals(await propertyHasStayGuideAccess('prop-1'), false);
  });
});

Deno.test('an active stay guide link below Pro answers plan_access_denied', async () => {
  const day = 86_400_000;
  await withStubbedDb(
    {
      features: featuresWith('propertyShowcase', false),
      guestSubmission: {
        id: 'booking-1',
        property_id: 'prop-1',
        status: 'READY_FOR_CHECKIN',
        stay_guide_token: 'tok-1',
        stay_guide_valid_from: new Date(Date.now() - day).toISOString(),
        stay_guide_valid_until: new Date(Date.now() + day).toISOString(),
      },
    },
    async () => {
      assertEquals(await loadGuestStayGuideByToken('tok-1'), STAY_GUIDE_PLAN_ACCESS_DENIED);
    }
  );
});
