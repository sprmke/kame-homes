/** Shared analytics dimensions — attached to every product event by capture helpers. */

export type AnalyticsEnvironment = 'local' | 'preview' | 'production';

export type AnalyticsAppTrack = 'mt' | 'legacy';

export type AnalyticsPersona = 'anonymous_guest' | 'guest' | 'host' | 'super_admin' | 'system';

export type AnalyticsSurface =
  | 'marketing'
  | 'guest_ops'
  | 'guest_account'
  | 'host_dashboard'
  | 'parking_dashboard'
  | 'super_admin'
  | 'edge';

export type AnalyticsPlanTier = 'free' | 'starter' | 'growth' | 'pro' | 'managed';

export type AnalyticsMode = 'full' | 'sampled' | 'errors_only' | 'off';

export type AnalyticsScope = {
  orgId?: string;
  propertyId?: string;
  parkingId?: string;
  orgSlug?: string;
  propertySlug?: string;
  parkingSlug?: string;
  planTier?: AnalyticsPlanTier;
  persona?: AnalyticsPersona;
  surface?: AnalyticsSurface;
};

export type SharedAnalyticsProperties = {
  environment: AnalyticsEnvironment;
  app_track: AnalyticsAppTrack;
  persona: AnalyticsPersona;
  surface: AnalyticsSurface;
  org_id?: string;
  property_id?: string;
  parking_id?: string;
  plan_tier?: AnalyticsPlanTier;
};
