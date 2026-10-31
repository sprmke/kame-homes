import { supabase } from '@/lib/supabase/client';

/** Session JWT when signed in; otherwise anon key (public edge functions). */
export async function guestEdgeAuthHeaders(): Promise<Record<string, string>> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
  };
}
