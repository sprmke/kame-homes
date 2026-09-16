/**
 * Collect unique team member emails for settings-change notices.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { loadAuthUserProfile } from './authUserProfile.ts';
import { normalizeInviteEmail } from './orgTeamPermissions.ts';

async function profileEmail(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const profile = await loadAuthUserProfile(supabase, userId);
  const email = profile.email?.trim();
  return email ? normalizeInviteEmail(email) : null;
}

export async function collectPropertySettingsNotifyEmails(
  supabase: SupabaseClient,
  organizationId: string,
  propertyId: string,
  ownerId: string
): Promise<string[]> {
  const emails = new Set<string>();

  const ownerEmail = await profileEmail(supabase, ownerId);
  if (ownerEmail) emails.add(ownerEmail);

  const { data: orgMembers } = await supabase
    .from('organization_members')
    .select('user_id, status')
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  for (const row of orgMembers ?? []) {
    const email = await profileEmail(supabase, row.user_id as string);
    if (email) emails.add(email);
  }

  const { data: propertyMembers } = await supabase
    .from('property_members')
    .select('user_id, status')
    .eq('property_id', propertyId)
    .eq('status', 'active');

  for (const row of propertyMembers ?? []) {
    const email = await profileEmail(supabase, row.user_id as string);
    if (email) emails.add(email);
  }

  return [...emails];
}

export async function collectParkingSettingsNotifyEmails(
  supabase: SupabaseClient,
  organizationId: string,
  parkingId: string,
  ownerId: string
): Promise<string[]> {
  const emails = new Set<string>();

  const ownerEmail = await profileEmail(supabase, ownerId);
  if (ownerEmail) emails.add(ownerEmail);

  const { data: orgMembers } = await supabase
    .from('organization_members')
    .select('user_id, status')
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  for (const row of orgMembers ?? []) {
    const email = await profileEmail(supabase, row.user_id as string);
    if (email) emails.add(email);
  }

  const { data: parkingMembers } = await supabase
    .from('parking_members')
    .select('user_id, status')
    .eq('parking_id', parkingId)
    .eq('status', 'active');

  for (const row of parkingMembers ?? []) {
    const email = await profileEmail(supabase, row.user_id as string);
    if (email) emails.add(email);
  }

  return [...emails];
}
