import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { supabase } from '@/lib/supabase/client';

export type PropertyTemplateCategory = 'standard' | 'email' | 'custom';

export type PropertyTemplateDto = {
  templateKey: string;
  name: string;
  category: PropertyTemplateCategory;
  content: string;
  defaultContent: string;
  isDefault: boolean;
  description: string | null;
  previewTemplateSlug: string | null;
  sectionImageUrl: string | null;
  /** Custom templates only: host folder holding this template, or null when ungrouped. */
  folderId: string | null;
  updatedAt: string | null;
};

export type PropertyTemplateFolderDto = {
  id: string;
  name: string;
  position: number;
  templateCount: number;
};

export type PropertyTemplatesData = {
  templates: PropertyTemplateDto[];
  placeholdersReference: string[];
  folders: PropertyTemplateFolderDto[];
};

export const PROPERTY_TEMPLATES_QUERY_KEY = ['property-templates'] as const;

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function usePropertyTemplates() {
  const propertyId = usePropertyIdParam();

  return useQuery({
    queryKey: [...PROPERTY_TEMPLATES_QUERY_KEY, propertyId],
    queryFn: async (): Promise<PropertyTemplatesData> => {
      const headers = await authHeaders();
      const res = await fetch(scopedFunctionsUrl('/property-templates-settings', propertyId), {
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to load templates');
      }
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: PropertyTemplatesData;
      };
      if (!json.success || !json.data?.templates) {
        throw new Error(json.error ?? 'Failed to load templates');
      }
      return {
        templates: json.data.templates,
        placeholdersReference: json.data.placeholdersReference ?? [],
        folders: json.data.folders ?? [],
      };
    },
    enabled: Boolean(propertyId),
  });
}

/**
 * Shared PATCH for the organise actions (rename / move / folder CRUD). They all
 * answer with the whole template list, so each one just invalidates and toasts.
 */
function useTemplateOrganiseMutation<TInput>(
  propertyId: string | null,
  invalidate: () => void,
  toBody: (input: TInput) => Record<string, unknown>,
  successMessage: string,
  failureMessage: string
) {
  return useMutation({
    mutationFn: async (input: TInput) => {
      const headers = await authHeaders();
      const res = await fetch(scopedFunctionsUrl('/property-templates-settings', propertyId), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(toBody(input)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? failureMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success(successMessage);
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, failureMessage));
    },
  });
}

export function usePropertyTemplateMutations() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [...PROPERTY_TEMPLATES_QUERY_KEY, propertyId],
    });
  };

  const saveTemplate = useMutation({
    mutationFn: async (input: {
      templateKey: string;
      content: string;
      name?: string;
      sectionImageUrl?: string | null;
      silent?: boolean;
      publicPagesAutosaveGate?: boolean;
    }) => {
      const headers = await authHeaders();
      const res = await fetch(scopedFunctionsUrl('/property-templates-settings', propertyId), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          templateKey: input.templateKey,
          content: input.content,
          name: input.name,
          sectionImageUrl: input.sectionImageUrl,
          ...(input.publicPagesAutosaveGate ? { publicPagesAutosaveGate: true } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to save template');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate();
      if (!variables.silent) {
        toast.success('Template saved');
      }
    },
    onError: (error: Error, variables) => {
      // Silent autosave still surfaces via Page Editor Unsaved/Save failed; toast on failure only.
      if (variables.silent) {
        toast.error(friendlyToastError(error, 'Could not save stay guide content'));
        return;
      }
      toast.error(friendlyToastError(error, 'Failed to save template'));
    },
  });

  const resetTemplate = useMutation({
    mutationFn: async (templateKey: string) => {
      const headers = await authHeaders();
      const res = await fetch(scopedFunctionsUrl('/property-templates-settings', propertyId), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'reset', templateKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to reset template');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success('Template reset');
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to reset template'));
    },
  });

  const createCustomTemplate = useMutation({
    mutationFn: async (input: {
      name: string;
      content: string;
      category?: PropertyTemplateCategory;
      /** Custom category only; omit for Stay guide / Emails. */
      folderId?: string | null;
    }): Promise<{
      templateKey: string | null;
    }> => {
      const headers = await authHeaders();
      const res = await fetch(scopedFunctionsUrl('/property-templates-settings', propertyId), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'create', ...input }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to create template');
      }
      const json = (await res.json()) as { data?: PropertyTemplatesData };
      /* The endpoint answers with the whole list, so the new key is whichever
       * custom template the cache did not already hold. Lets the caller open it. */
      const knownKeys = new Set(
        (
          queryClient.getQueryData<PropertyTemplatesData>([
            ...PROPERTY_TEMPLATES_QUERY_KEY,
            propertyId,
          ])?.templates ?? []
        ).map((template) => template.templateKey)
      );
      const created = json.data?.templates?.find(
        (template) =>
          template.templateKey.startsWith('custom-') && !knownKeys.has(template.templateKey)
      );
      return { templateKey: created?.templateKey ?? null };
    },
    onSuccess: () => {
      invalidate();
      toast.success('Template created');
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to create template'));
    },
  });

  const deleteCustomTemplate = useMutation({
    mutationFn: async (templateKey: string) => {
      const headers = await authHeaders();
      const res = await fetch(scopedFunctionsUrl('/property-templates-settings', propertyId), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'delete', templateKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to delete template');
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success('Template deleted');
    },
    onError: (error: Error) => {
      toast.error(friendlyToastError(error, 'Failed to delete template'));
    },
  });

  const renameCustomTemplate = useTemplateOrganiseMutation<{ templateKey: string; name: string }>(
    propertyId,
    invalidate,
    (input) => ({ action: 'rename', ...input }),
    'Template renamed',
    'Failed to rename template'
  );

  const moveCustomTemplate = useTemplateOrganiseMutation<{
    templateKey: string;
    category: PropertyTemplateCategory;
    folderId: string | null;
  }>(
    propertyId,
    invalidate,
    (input) => ({ action: 'move', ...input }),
    'Template moved',
    'Failed to move template'
  );

  const createTemplateFolder = useTemplateOrganiseMutation<{ name: string }>(
    propertyId,
    invalidate,
    (input) => ({ action: 'createFolder', ...input }),
    'Folder created',
    'Failed to create folder'
  );

  const renameTemplateFolder = useTemplateOrganiseMutation<{ folderId: string; name: string }>(
    propertyId,
    invalidate,
    (input) => ({ action: 'renameFolder', ...input }),
    'Folder renamed',
    'Failed to rename folder'
  );

  const deleteTemplateFolder = useTemplateOrganiseMutation<{ folderId: string }>(
    propertyId,
    invalidate,
    (input) => ({ action: 'deleteFolder', ...input }),
    'Folder deleted',
    'Failed to delete folder'
  );

  return {
    saveTemplate,
    resetTemplate,
    createCustomTemplate,
    deleteCustomTemplate,
    renameCustomTemplate,
    moveCustomTemplate,
    createTemplateFolder,
    renameTemplateFolder,
    deleteTemplateFolder,
  };
}

/** Manual send of a saved custom template to a booking's guest. */
export function useSendPropertyCustomTemplateEmail() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (input: {
      bookingId: string;
      templateKey: string;
    }): Promise<{ bookingId: string; templateKey: string }> => {
      const headers = await authHeaders();
      const res = await fetch(
        scopedFunctionsUrl('/send-property-custom-template-email', propertyId),
        {
          method: 'POST',
          headers,
          body: JSON.stringify(input),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        bookingId?: string;
        templateKey?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to send template');
      }
      return { bookingId: input.bookingId, templateKey: input.templateKey };
    },
  });
}

export function usePropertyTemplatePreview() {
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async (input: {
      templateKey: string;
      category: PropertyTemplateCategory;
      content: string;
      name?: string;
    }): Promise<{ html: string; mode: string }> => {
      const headers = await authHeaders();
      const res = await fetch(scopedFunctionsUrl('/property-templates-preview', propertyId), {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to render preview');
      }
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { html: string; mode: string };
      };
      if (!json.success || !json.data) {
        throw new Error(json.error ?? 'Failed to render preview');
      }
      return json.data;
    },
  });
}
