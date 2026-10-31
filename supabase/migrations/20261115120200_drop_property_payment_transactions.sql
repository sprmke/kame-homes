-- Last piece of the per-property billing system — orphaned once
-- propertySubscriptionCheckout.ts/create-subscription-checkout were removed (org-level billing
-- is now the only path, see 20261115120000_org_level_billing_migration.sql). No live paying
-- customers to preserve (confirmed with host), so this is a clean drop, not a deferred one.
DROP TABLE IF EXISTS public.property_payment_transactions;
