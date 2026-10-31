/**
 * Platform payment settings singleton — shared by checkout + billing orchestrator
 * without creating an import cycle between those modules.
 */

import { createClient } from './supabaseJs.ts';

export type PlatformPaymentSettings = {
  enabledPaymentMethods: string[];
  enabledBanks: string[];
  renewalLinkLeadDays: number;
  gracePeriodDays: number;
};

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

export async function getPlatformPaymentSettings(): Promise<PlatformPaymentSettings> {
  const sb = db();
  const { data, error } = await sb
    .from('platform_payment_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const methods = data?.enabled_payment_methods;
  const banks = data?.enabled_banks;

  return {
    enabledPaymentMethods: Array.isArray(methods)
      ? methods.filter((m): m is string => typeof m === 'string')
      : ['qrph', 'paymaya', 'dob'],
    enabledBanks: Array.isArray(banks)
      ? banks.filter((b): b is string => typeof b === 'string')
      : [],
    renewalLinkLeadDays: Number(data?.renewal_link_lead_days ?? 5),
    gracePeriodDays: Number(data?.grace_period_days ?? 5),
  };
}
