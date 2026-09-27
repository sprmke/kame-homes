import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AntiSpamRequestFields } from '@/lib/security/antiSpamRequest';

import { useSupportTicketScope } from './useSupportTicketScope';
import {
  fetchSupportTicket,
  fetchSupportTickets,
  replySupportTicket,
  reopenSupportTicket,
  submitSupportTicket,
  uploadSupportTicketAttachment,
  type SubmitSupportTicketPayload,
  type SupportTicketScopeParams,
} from '../lib/supportTicketApi';

import type { SupportTicketAttachmentDraft } from '../lib/supportTicketSchema';

function scopeKey(scope: SupportTicketScopeParams) {
  return [
    scope.channel ?? 'host',
    scope.orgSlug,
    scope.orgId,
    scope.propertyId,
    scope.parkingId,
  ] as const;
}

function scopeEnabled(scope: SupportTicketScopeParams): boolean {
  if (scope.channel === 'guest') return true;
  if (scope.channel === 'host') return Boolean(scope.orgSlug || scope.orgId);
  // Guest explore (/account/tickets): no org params — matches server guest channel fallback.
  if (!scope.orgSlug && !scope.orgId && !scope.propertyId && !scope.parkingId) return true;
  return Boolean(scope.orgSlug || scope.orgId);
}

export function useSupportTickets() {
  const scope = useSupportTicketScope();
  return useQuery({
    queryKey: ['support-tickets', ...scopeKey(scope)],
    queryFn: () => fetchSupportTickets(scope),
    enabled: scopeEnabled(scope),
  });
}

export function useSupportTicket(ticketId: string | null) {
  const scope = useSupportTicketScope();
  return useQuery({
    queryKey: ['support-ticket', ticketId, ...scopeKey(scope)],
    queryFn: () => fetchSupportTicket(scope, ticketId as string),
    enabled: Boolean(ticketId) && scopeEnabled(scope),
  });
}

export function useSubmitSupportTicket() {
  const qc = useQueryClient();
  const scope = useSupportTicketScope();

  return useMutation({
    mutationFn: ({
      antiSpam,
      ...payload
    }: Omit<SubmitSupportTicketPayload, keyof SupportTicketScopeParams> & {
      antiSpam?: Partial<AntiSpamRequestFields>;
    }) => submitSupportTicket({ ...scope, ...payload }, antiSpam),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['support-tickets', ...scopeKey(scope)] });
    },
  });
}

export function useReplySupportTicket(ticketId: string) {
  const qc = useQueryClient();
  const scope = useSupportTicketScope();

  return useMutation({
    mutationFn: (args: { message: string; attachments?: SupportTicketAttachmentDraft[] }) =>
      replySupportTicket(scope, ticketId, args.message, args.attachments),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['support-ticket', ticketId, ...scopeKey(scope)] }),
        qc.invalidateQueries({ queryKey: ['support-tickets', ...scopeKey(scope)] }),
      ]);
    },
  });
}

export function useReopenSupportTicket(ticketId: string) {
  const qc = useQueryClient();
  const scope = useSupportTicketScope();

  return useMutation({
    mutationFn: () => reopenSupportTicket(scope, ticketId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['support-ticket', ticketId, ...scopeKey(scope)] }),
        qc.invalidateQueries({ queryKey: ['support-tickets', ...scopeKey(scope)] }),
      ]);
    },
  });
}

export function useUploadSupportTicketAttachment() {
  const scope = useSupportTicketScope();
  return useMutation({
    mutationFn: (file: File) => uploadSupportTicketAttachment(scope, file),
  });
}
