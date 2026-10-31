/**
 * Shared org Plans & Billing Playwright fixtures — downgrade + checkout harnesses.
 */

import { DEFAULT_PLAN_FEATURES } from '../../../../src/features/dashboard/plans/lib/planFeatures';
import { discountedPlanPricePhp } from '../../../../src/features/dashboard/plans/lib/planPricing';
import {
  goldenPlanId,
  goldenSoldPlanDtos,
} from '../../../../src/features/dashboard/plans/lib/planTierGolden';

import type { Page, Route } from '@playwright/test';

export const PLANS_E2E_ORG_ID = 'org-plans-downgrade-e2e';
export const PLANS_E2E_ORG_SLUG = 'kame-homes-ph';
export const PLANS_E2E_PROPERTY_ID = 'property-plans-downgrade-e2e';
export const PLANS_E2E_PROPERTY_SLUG = 'solea-mactan';

export const PLAN_FREE = goldenPlanId('free');
export const PLAN_STARTER = goldenPlanId('starter');
export const PLAN_GROWTH = goldenPlanId('growth');
export const PLAN_PRO = goldenPlanId('pro');
export const PLAN_MANAGED = goldenPlanId('managed');

const SUPABASE_AUTH_STORAGE_KEY = 'sb-127-auth-token';

/** All features off. Entitlement mocks that should not unlock anything spread this. */
export function emptyPlanFeatures() {
  return { ...DEFAULT_PLAN_FEATURES, teamManagement: { ...DEFAULT_PLAN_FEATURES.teamManagement } };
}

/**
 * Plan catalog for every Plans / pricing E2E, built from the golden tier matrix
 * (`planTierGolden.ts`, verified against the seed migrations by `bun run check:plan-catalog`).
 * Never hand-write tier features here: that is how fixtures drift from the real tiers.
 */
export const PLANS_E2E_CATALOG = goldenSoldPlanDtos();

/** What a host is actually charged per property: list price after the promo discount. */
export function planChargedPhp(plan: { pricePhp: number | null; discountPercent: number }): number {
  return discountedPlanPricePhp(plan.pricePhp, plan.discountPercent);
}

export function e2eSupabaseAuthSession() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    access_token: 'playwright-plans-token',
    refresh_token: 'playwright-plans-refresh',
    expires_in: 60 * 60,
    expires_at: nowSeconds + 60 * 60,
    token_type: 'bearer',
    user: {
      id: 'user-plans-downgrade-e2e',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'owner@example.com',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Plans Owner' },
      identities: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

export async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export function organizationList(accessKind: 'owner' | 'member') {
  return {
    organizations: [
      {
        id: PLANS_E2E_ORG_ID,
        name: 'Kame Homes PH',
        slug: PLANS_E2E_ORG_SLUG,
        description: null,
        logoUrl: null,
        settings: {
          setupGuide: {
            version: 1,
            dismissedAt: '2026-01-01T00:00:00.000Z',
            completedAt: null,
            lastStepId: null,
            skippedSteps: [],
            reviewedSteps: [],
          },
        },
        accessKind: accessKind === 'owner' ? 'owner' : 'org_admin',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

export function orgAccessPayload(accessKind: 'owner' | 'member') {
  const permissions =
    accessKind === 'owner'
      ? [
          'org.dashboard:view',
          'org.bookings:view',
          'org.properties:view',
          'org.parkings:view',
          'org.team:view',
          'org.settings:view',
          'org.plans:view',
        ]
      : ['org.dashboard:view', 'org.plans:view'];

  return {
    accessKind: accessKind === 'owner' ? ('owner' as const) : ('org_admin' as const),
    permissions,
    memberId: accessKind === 'owner' ? null : 'member-plans-e2e',
    canListAllProperties: accessKind === 'owner',
    orgId: PLANS_E2E_ORG_ID,
    orgSlug: PLANS_E2E_ORG_SLUG,
    orgName: 'Kame Homes PH',
    planLimited: false,
    canManageTeam: accessKind === 'owner',
    canInviteTeam: accessKind === 'owner',
    canCreateProperties: accessKind === 'owner',
    canManageProperties: accessKind === 'owner',
    canCreateParkings: accessKind === 'owner',
    canManageParkings: accessKind === 'owner',
    canEditBasicSettings: accessKind === 'owner',
    canEditSocials: accessKind === 'owner',
    canEditAiPlatform: accessKind === 'owner',
    canEditAiAssistant: accessKind === 'owner',
    canEditSettings: accessKind === 'owner',
    canViewPlans: true,
  };
}

export function dashboardStatsPayload() {
  return {
    manilaDate: '2026-08-28',
    attention: [],
    pipeline: [],
    trendWindow: { from: '2026-08-01', to: '2026-08-31', label: 'Aug 2026' },
    upcoming: [],
    finance: {
      monthNet: 0,
      monthStays: 0,
      outstandingBalance: 0,
    },
  };
}

export async function installPlansE2eSession(page: Page) {
  await page.addInitScript(
    ({ authKey, session, supabaseAuthKey, supabaseAuthSession, orgSlug, orgId }) => {
      window.localStorage.setItem(authKey, JSON.stringify(session));
      window.localStorage.setItem(supabaseAuthKey, JSON.stringify(supabaseAuthSession));
      window.localStorage.setItem('kame-last-org-slug', orgSlug);
      window.localStorage.setItem('kame-last-tenant-kind', 'org');
      try {
        window.sessionStorage.setItem(`setup-guide:snooze:${orgId}`, '1');
      } catch {
        /* ignore */
      }
    },
    {
      authKey: 'kame:e2e-admin-session',
      supabaseAuthKey: SUPABASE_AUTH_STORAGE_KEY,
      supabaseAuthSession: e2eSupabaseAuthSession(),
      session: {
        accessToken: 'playwright-plans-token',
        refreshToken: 'playwright-plans-refresh',
        userId: 'user-plans-downgrade-e2e',
        email: 'owner@example.com',
        name: 'Plans Owner',
      },
      orgSlug: PLANS_E2E_ORG_SLUG,
      orgId: PLANS_E2E_ORG_ID,
    }
  );
}

export const plansE2ePaths = {
  orgPlans: (tab: 'plans' | 'billing' | 'compare' = 'plans') =>
    `/org/${PLANS_E2E_ORG_SLUG}/plans?tab=${tab}`,
  orgPlansCheckoutReturn: (result: 'success' | 'cancelled') =>
    `/org/${PLANS_E2E_ORG_SLUG}/plans?tab=billing&checkout=${result}`,
  /** Legacy property URL — redirects to `orgPlans`. */
  propertyPlansRedirect: `/org/${PLANS_E2E_ORG_SLUG}/property/${PLANS_E2E_PROPERTY_SLUG}/plans`,
} as const;
