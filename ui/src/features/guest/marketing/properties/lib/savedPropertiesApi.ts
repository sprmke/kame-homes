import { supabase } from '@/lib/supabase/client';

export type GuestSavedPropertyRow = {
  property_slug: string;
  created_at: string;
};

export async function fetchSavedPropertySlugs(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('guest_saved_properties')
    .select('property_slug')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => row.property_slug);
}

export async function savePropertySlug(propertySlug: string): Promise<void> {
  const slug = propertySlug.trim();
  if (!slug) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to save properties.');

  const { error } = await supabase.from('guest_saved_properties').insert({
    user_id: user.id,
    property_slug: slug,
  });

  if (error) {
    // Already saved — treat as success.
    if (error.code === '23505') return;
    throw error;
  }
}

export async function unsavePropertySlug(propertySlug: string): Promise<void> {
  const slug = propertySlug.trim();
  if (!slug) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to manage saved properties.');

  const { error } = await supabase
    .from('guest_saved_properties')
    .delete()
    .eq('property_slug', slug);

  if (error) throw error;
}
