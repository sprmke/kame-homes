import { useState } from 'react';

import { ScanFace } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalTitle } from '@/components/ui/responsive-modal';

import { IdentityVerificationFlow } from './IdentityVerificationFlow';

import type { IdentitySubmitResponse } from '../lib/identityApi';

type HostIdentityVerifyButtonProps = {
  organizationId: string;
  onDocumentCaptured: (file: File) => void;
  onVerified?: (result: IdentitySubmitResponse) => void;
  disabled?: boolean;
};

/**
 * "Verify with camera" for host Tier 1. Produces the same `File` the existing
 * `upload-org-verification-asset` call already expects, and records an `org_owner`
 * verdict so the reviewer sees a pre-screen alongside the document card.
 */
export function HostIdentityVerifyButton({
  organizationId,
  onDocumentCaptured,
  onVerified,
  disabled,
}: HostIdentityVerifyButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <ScanFace className="mr-2 h-4 w-4" />
        Verify with camera
      </Button>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent sheetLayout="split" className="sm:max-w-md">
          <div className="px-4 pt-4">
            <ResponsiveModalTitle>Verify your identity</ResponsiveModalTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {open && (
              <IdentityVerificationFlow
                subjectKind="org_owner"
                organizationId={organizationId}
                onDocumentCaptured={onDocumentCaptured}
                onComplete={(result) => {
                  onVerified?.(result);
                  setOpen(false);
                }}
                onCancel={() => setOpen(false)}
              />
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
