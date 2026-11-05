export type PublicSupportFaq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  audience: 'host' | 'guest' | 'public';
  sortOrder: number;
};

function baseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
}

export async function fetchPublicSupportFaqs(): Promise<{ faqs: PublicSupportFaq[] }> {
  const res = await fetch(`${baseUrl()}/list-public-support-faqs`, {
    headers: { Accept: 'application/json' },
  });
  const json = (await res.json()) as { success?: boolean; error?: string; data?: unknown };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Could not load support content');
  }
  const data = json.data as { faqs?: PublicSupportFaq[] } | undefined;
  return { faqs: data?.faqs ?? [] };
}

export function isGuestFaq(faq: PublicSupportFaq): boolean {
  return faq.audience === 'guest' || faq.audience === 'public';
}

export function isHostFaq(faq: PublicSupportFaq): boolean {
  return faq.audience === 'host' || faq.audience === 'public';
}
