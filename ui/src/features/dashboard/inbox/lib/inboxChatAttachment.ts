import type { InboxApiScope } from '@/features/dashboard/inbox/lib/inboxApi';
import {
  scopedOrgFunctionsUrl,
  useOrgIdParam,
  useOrgSlugParam,
} from '@/features/dashboard/org/lib/adminApiScope';

import { prepareUpload } from '@/lib/media/prepareUpload';
import { supabase } from '@/lib/supabase/client';

export type InboxChatAttachment = {
  kind: 'image' | 'file';
  url: string;
  label?: string;
};

async function getJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

function inboxUploadUrl(
  orgSlug: string | null,
  orgId: string | null,
  scope?: InboxApiScope | null
) {
  let url = scopedOrgFunctionsUrl('/upload-inbox-chat-asset', orgSlug, orgId);
  if (scope?.propertyId) {
    const parsed = new URL(url);
    parsed.searchParams.set('property_id', scope.propertyId);
    url = parsed.toString();
  }
  if (scope?.parkingId) {
    const parsed = new URL(url);
    parsed.searchParams.set('parking_id', scope.parkingId);
    url = parsed.toString();
  }
  return url;
}

export async function uploadInboxChatAttachment(
  orgSlug: string | null,
  orgId: string | null,
  conversationId: string,
  file: File,
  scope?: InboxApiScope | null
): Promise<InboxChatAttachment> {
  const prepared = await prepareUpload(file, {
    imagePreset: 'CONTENT',
    surface: 'guest-chat-attachment',
  });
  if (prepared.error) throw new Error(prepared.error);

  const formData = new FormData();
  formData.append('file', prepared.file);
  formData.append('fileName', prepared.file.name);
  formData.append('conversationId', conversationId);
  if (scope?.propertyId) formData.append('propertyId', scope.propertyId);
  if (scope?.parkingId) formData.append('parkingId', scope.parkingId);

  const jwt = await getJwt();
  const res = await fetch(inboxUploadUrl(orgSlug, orgId, scope), {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { attachment?: InboxChatAttachment };
    attachment?: InboxChatAttachment;
  };
  if (!json.success) throw new Error(json.error ?? 'Upload failed');
  const attachment = json.data?.attachment ?? json.attachment;
  if (!attachment?.url) throw new Error('Upload failed');
  return attachment;
}

export function useInboxOrgScopeForUpload() {
  return { orgSlug: useOrgSlugParam(), orgId: useOrgIdParam() };
}
