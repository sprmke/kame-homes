import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { usePropertyIdParam, scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type MarketingTemplateRecord = {
  id: string;
  name: string;
  contentType: 'calendar' | 'design' | 'video';
  platform: string | null;
  aspectPreset: string | null;
  designJson: Record<string, unknown>;
  /** Theme the item was made in; null for items saved before themes. */
  themeKey?: string | null;
  updatedAt: string;
};

export type SaveMarketingTemplatePayload = {
  name: string;
  contentType: 'calendar' | 'design' | 'video';
  platform?: string;
  aspectPreset?: string;
  designJson: Record<string, unknown>;
  /** Theme the item belongs to (`marketing_templates.theme_key`). */
  themeKey?: string | null;
};

async function parseEdgeJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data as T;
}

export async function fetchMarketingTemplates(
  propertyId: string | null
): Promise<MarketingTemplateRecord[]> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('marketing-templates', propertyId), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await parseEdgeJson<{ templates: MarketingTemplateRecord[] }>(res);
  return data.templates ?? [];
}

export async function saveMarketingTemplate(
  propertyId: string | null,
  payload: SaveMarketingTemplatePayload
): Promise<MarketingTemplateRecord> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('marketing-templates', propertyId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseEdgeJson(res);
}

export type UpdateMarketingTemplatePayload = {
  id: string;
  name?: string;
  designJson?: Record<string, unknown>;
  aspectPreset?: string;
  platform?: string;
  themeKey?: string | null;
};

export async function updateMarketingTemplate(
  propertyId: string | null,
  payload: UpdateMarketingTemplatePayload
): Promise<MarketingTemplateRecord> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('marketing-templates', propertyId), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseEdgeJson(res);
}

export async function deleteMarketingTemplate(
  propertyId: string | null,
  templateId: string
): Promise<void> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('marketing-templates', propertyId), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: templateId }),
  });
  await parseEdgeJson(res);
}

export function useMarketingTemplates(contentType?: 'calendar' | 'design' | 'video') {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: ['marketing-templates', propertyId, contentType],
    queryFn: async () => {
      const templates = await fetchMarketingTemplates(propertyId);
      return contentType ? templates.filter((t) => t.contentType === contentType) : templates;
    },
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useSaveMarketingTemplate() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveMarketingTemplatePayload) =>
      saveMarketingTemplate(propertyId, payload),
    onSuccess: () => {
      toast.success('Template saved');
      void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
    },
    onError: (error: Error) => toast.error(error.message || 'Save failed'),
  });
}

export function useUpdateMarketingTemplate() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateMarketingTemplatePayload) =>
      updateMarketingTemplate(propertyId, payload),
    onSuccess: () => {
      toast.success('Template updated');
      void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
    },
    onError: (error: Error) => toast.error(error.message || 'Update failed'),
  });
}

export function useDeleteMarketingTemplate() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => deleteMarketingTemplate(propertyId, templateId),
    onSuccess: () => {
      toast.success('Template removed');
      void queryClient.invalidateQueries({ queryKey: ['marketing-templates', propertyId] });
    },
    onError: (error: Error) => toast.error(error.message || 'Delete failed'),
  });
}
