import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { HelpCenterFaq } from '@/features/dashboard/help-support/lib/helpCenterApi';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import { ADMIN_DEFAULT_PAGE_SIZE } from '@/lib/table/pagination';

export type AdminHelpCenterFaq = HelpCenterFaq & { is_published: boolean };

export const HELP_CENTER_FAQS_ADMIN_QUERY_KEY = ['super-admin', 'help-center-faqs'] as const;

export function useHelpCenterFaqsAdmin(params?: { page?: number; limit?: number }) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? ADMIN_DEFAULT_PAGE_SIZE;

  return useQuery({
    queryKey: [...HELP_CENTER_FAQS_ADMIN_QUERY_KEY, page, limit] as const,
    queryFn: () =>
      callEdgeFunction<{ faqs: AdminHelpCenterFaq[]; total: number }>(
        `list-help-center-faqs-admin?page=${page}&limit=${limit}`
      ),
    placeholderData: keepPreviousData,
  });
}

export type CreateFaqInput = {
  category: string;
  question: string;
  answer: string;
  sortOrder?: number;
  isPublished?: boolean;
};

export type UpdateFaqInput = {
  id: string;
  category?: string;
  question?: string;
  answer?: string;
  sortOrder?: number;
  isPublished?: boolean;
};

export function useCreateHelpCenterFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFaqInput) =>
      callEdgeFunction<{ faq: AdminHelpCenterFaq }>('create-help-center-faq', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: HELP_CENTER_FAQS_ADMIN_QUERY_KEY });
    },
  });
}

export function useUpdateHelpCenterFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFaqInput) =>
      callEdgeFunction<{ faq: AdminHelpCenterFaq }>('update-help-center-faq', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: HELP_CENTER_FAQS_ADMIN_QUERY_KEY });
    },
  });
}

export function useDeleteHelpCenterFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      callEdgeFunction<{ deleted: boolean }>('delete-help-center-faq', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: HELP_CENTER_FAQS_ADMIN_QUERY_KEY });
    },
  });
}
