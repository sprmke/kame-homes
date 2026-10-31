import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type HelpCenterArticle = {
  routeGuidePath: string;
  title: string;
  routePath: string | null;
  module: string;
  qaItems: Array<{ question: string; answer: string }>;
};

async function callHelpCenterFn<T>(url: string, init?: RequestInit): Promise<T> {
  const jwt = await getSessionJwt();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data as T;
}

function baseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
}

export function fetchHelpCenterArticles(): Promise<{ articles: HelpCenterArticle[] }> {
  return callHelpCenterFn(`${baseUrl()}/list-help-center-articles`);
}

export type HelpCenterFaq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  /** Route guide path used to scope common FAQs to org / property / parking. */
  source_route_guide_path?: string | null;
};

export function fetchHelpCenterFaqs(): Promise<{ faqs: HelpCenterFaq[] }> {
  return callHelpCenterFn(`${baseUrl()}/list-help-center-faqs`);
}
