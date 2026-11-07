import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';

import { Button } from '@/components/ui/button';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalTitle } from '@/components/ui/responsive-modal';

import { IdentityVerificationFlow } from './IdentityVerificationFlow';
import { VerificationResultBadge } from './VerificationResultBadge';
import { myIdentityQueryKey, useMyIdentity } from '../hooks/useIdentitySession';
import { deleteIdentityVerification } from '../lib/identityApi';

function formatDate(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Account-level identity card on `/account/profile`. Verify once, reuse across bookings,
 * and delete the verification without contacting support.
 */
export function GuestIdentityCard() {
  const { session } = useGuestSession();
  const { data, isLoading } = useMyIdentity(Boolean(session));
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const verification = data?.verification ?? null;

  const handleDelete = async () => {
    if (!verification) return;
    setDeleting(true);
    try {
      await deleteIdentityVerification(verification.id);
      await queryClient.invalidateQueries({ queryKey: myIdentityQueryKey });
      toast.success('Verification deleted');
      setConfirmDelete(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border-border space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Identity</p>
          {isLoading ? (
            <span className="bg-muted inline-block h-3 w-24 animate-pulse rounded" aria-hidden />
          ) : verification ? (
            <div className="flex items-center gap-2">
              <VerificationResultBadge verdict={verification.verdict} flags={verification.flags} />
              {verification.maskedName && (
                <span className="text-muted-foreground text-xs">{verification.maskedName}</span>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">Not verified yet</p>
          )}
        </div>

        {verification ? (
          <BadgeCheck className="h-5 w-5 text-emerald-500" aria-hidden />
        ) : null}
      </div>

      {verification?.expiresAt && (
        <p className="text-muted-foreground text-xs">Valid until {formatDate(verification.expiresAt)}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          {verification ? 'Verify again' : 'Verify your ID'}
        </Button>
        {verification && !confirmDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            Delete verification
          </Button>
        )}
      </div>

      {confirmDelete && (
        <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-xs">
            This removes your verification and its photos. Bookings keep the ID you already
            uploaded.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent sheetLayout="split" className="sm:max-w-md">
          <div className="px-4 pt-4">
            <ResponsiveModalTitle>Verify your ID</ResponsiveModalTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {open && (
              <IdentityVerificationFlow
                subjectKind="guest"
                email={session?.user?.email ?? ''}
                onComplete={() => {
                  setOpen(false);
                  void queryClient.invalidateQueries({ queryKey: myIdentityQueryKey });
                }}
                onCancel={() => setOpen(false)}
              />
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
