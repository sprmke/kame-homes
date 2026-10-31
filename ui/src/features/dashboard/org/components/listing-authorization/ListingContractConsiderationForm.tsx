import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { listingAuthorizationAssetsQueryKey } from '@/features/dashboard/org/hooks/useListingAuthorization';
import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import {
  hasActiveConsiderationGrant,
  isInGracePeriod,
  isListingAccessLocked,
  type ContractLegLifecycle,
} from '@/features/dashboard/org/lib/contractLifecycle';
import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import type { ListingKind } from '@/features/dashboard/org/lib/listingAuthorization';
import {
  todayManilaYmd,
  validateVerificationFile,
  VERIFICATION_ACCEPT,
} from '@/features/dashboard/org/lib/orgVerification';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { prepareUpload } from '@/lib/media/prepareUpload';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

function canSubmitConsideration(
  lifecycle: ContractLegLifecycle,
  contractEndYmd: string | null,
  todayYmd: string
): boolean {
  if (!contractEndYmd) return false;
  if (!isInGracePeriod(contractEndYmd, todayYmd)) return false;
  if (isListingAccessLocked(lifecycle) && !lifecycle.consideration.allowConsiderationOverride) {
    return false;
  }
  if (lifecycle.consideration.selfServeUsedThisCycle) return false;
  if (lifecycle.consideration.status === 'pending') return false;
  if (hasActiveConsiderationGrant(lifecycle, todayYmd)) return false;
  return true;
}

async function uploadConsiderationProof(
  orgId: string,
  listingKind: ListingKind,
  file: File
): Promise<string> {
  const prepared = await prepareUpload(file, {
    imagePreset: 'DOCUMENT',
    surface: 'listing-consideration-proof',
  });
  if (prepared.error) throw new Error(prepared.error);
  const preparedFile = prepared.file;

  const jwt = await getSessionJwt();
  const body = new FormData();
  body.append('orgId', orgId);
  body.append(
    'assetType',
    listingKind === 'parking' ? 'parking_consideration_proof' : 'property_consideration_proof'
  );
  body.append('file', preparedFile);
  body.append('fileName', preparedFile.name);

  const res = await fetch(`${FUNCTIONS_URL}/upload-org-verification-asset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body,
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { path: string };
  };
  if (!res.ok || !json.success || !json.data?.path) {
    throw new Error(json.error ?? 'Upload failed');
  }
  return json.data.path;
}

type Props = {
  listingKind: ListingKind;
  listingId: string;
  orgId: string;
  contractEndYmd: string | null;
  lifecycle: ContractLegLifecycle;
  /** When locked, only show if SA enabled override. */
  allowLockedOverride?: boolean;
  /** Lets the host modal guard its close while this draft is unsent. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Filled with a submit that resolves false when blocked or failed. */
  saveRef?: MutableRefObject<(() => Promise<boolean>) | null>;
};

export function ListingContractConsiderationForm({
  listingKind,
  listingId,
  orgId,
  contractEndYmd,
  lifecycle,
  allowLockedOverride = false,
  onDirtyChange,
  saveRef,
}: Props) {
  const today = todayManilaYmd();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const locked = isListingAccessLocked(lifecycle);
  const canSubmit =
    canSubmitConsideration(lifecycle, contractEndYmd, today) ||
    (allowLockedOverride && locked && lifecycle.consideration.allowConsiderationOverride);

  const [note, setNote] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPath, setProofPath] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      let path = proofPath.trim();
      if (proofFile) {
        path = await uploadConsiderationProof(orgId, listingKind, proofFile);
      }
      if (!path) throw new Error('Proof is required');
      await callEdgeFunction('submit-contract-consideration', {
        method: 'POST',
        body: JSON.stringify({
          listingKind,
          listingId,
          note,
          expectedDate,
          proofPaths: [path],
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Consideration submitted');
      setNote('');
      setExpectedDate('');
      setProofFile(null);
      setProofPath('');
      if (fileRef.current) fileRef.current.value = '';
      await qc.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      await qc.invalidateQueries({
        queryKey: listingAuthorizationAssetsQueryKey(listingKind, listingId),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const draftDirty = note.trim() !== '' || expectedDate !== '' || proofFile !== null;
  useEffect(() => {
    onDirtyChange?.(draftDirty);
    return () => onDirtyChange?.(false);
  }, [draftDirty, onDirtyChange]);

  if (saveRef) {
    saveRef.current = async () => {
      if (!note.trim() || !expectedDate || !proofFile) return false;
      try {
        await submitMutation.mutateAsync();
        return true;
      } catch {
        return false;
      }
    };
  }

  if (!canSubmit) return null;

  return (
    <div className="border-border space-y-2 border-t pt-3">
      <Textarea
        aria-label="Consideration note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
        className="min-h-[72px]"
      />
      <Input
        type="date"
        aria-label="Requested access until"
        value={expectedDate}
        onChange={(e) => setExpectedDate(e.target.value)}
        className="h-10"
      />
      <Input
        ref={fileRef}
        type="file"
        accept={VERIFICATION_ACCEPT}
        aria-label="Consideration proof"
        className="h-10 py-1.5"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (!file) {
            setProofFile(null);
            return;
          }
          const err = validateVerificationFile(file);
          if (err) {
            toast.error(err);
            e.target.value = '';
            setProofFile(null);
            return;
          }
          setProofFile(file);
          setProofPath('');
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] w-full"
        disabled={submitMutation.isPending || !note.trim() || !expectedDate || !proofFile}
        onClick={() => submitMutation.mutate()}
      >
        Request consideration
      </Button>
    </div>
  );
}
