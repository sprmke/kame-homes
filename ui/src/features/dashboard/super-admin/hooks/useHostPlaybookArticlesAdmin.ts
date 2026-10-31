import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import { ADMIN_DEFAULT_PAGE_SIZE } from '@/lib/table/pagination';

export type AdminPlaybookArticle = {
  id: string;
  slug: string;
  category: string;
  title: string;
  body_md: string;
  applies_when: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const PLAYBOOK_ARTICLES_ADMIN_QUERY_KEY = ['super-admin', 'host-playbook-articles'] as const;

export function useHostPlaybookArticlesAdmin(params?: { page?: number; limit?: number }) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? ADMIN_DEFAULT_PAGE_SIZE;

  return useQuery({
    queryKey: [...PLAYBOOK_ARTICLES_ADMIN_QUERY_KEY, page, limit] as const,
    queryFn: () =>
      callEdgeFunction<{ articles: AdminPlaybookArticle[]; total: number }>(
        `list-host-playbook-articles-admin?page=${page}&limit=${limit}`
      ),
    placeholderData: keepPreviousData,
  });
}

export type CreatePlaybookArticleInput = {
  slug: string;
  category: string;
  title: string;
  bodyMd: string;
  appliesWhen?: Record<string, unknown>;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdatePlaybookArticleInput = {
  id: string;
  category?: string;
  title?: string;
  bodyMd?: string;
  appliesWhen?: Record<string, unknown>;
  sortOrder?: number;
  isActive?: boolean;
};

export function useCreatePlaybookArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlaybookArticleInput) =>
      callEdgeFunction<{ article: AdminPlaybookArticle }>('create-host-playbook-article', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PLAYBOOK_ARTICLES_ADMIN_QUERY_KEY });
    },
  });
}

export function useUpdatePlaybookArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlaybookArticleInput) =>
      callEdgeFunction<{ article: AdminPlaybookArticle }>('update-host-playbook-article', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PLAYBOOK_ARTICLES_ADMIN_QUERY_KEY });
    },
  });
}

export function useDeletePlaybookArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      callEdgeFunction<{ deleted: boolean }>('delete-host-playbook-article', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PLAYBOOK_ARTICLES_ADMIN_QUERY_KEY });
    },
  });
}
