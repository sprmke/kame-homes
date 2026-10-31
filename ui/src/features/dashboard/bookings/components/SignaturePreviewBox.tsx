import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export const signatureFrameClassName =
  'border-border bg-background h-[120px] w-full rounded-lg border border-dashed';

type SignaturePreviewBoxProps = {
  url: string | null;
  className?: string;
};

export function SignaturePreviewBox({ url, className }: SignaturePreviewBoxProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setDisplayUrl(null);
      return undefined;
    }

    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setDisplayUrl(url);
      return undefined;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void fetch(url, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load signature (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled || blob.size === 0) return;
        objectUrl = URL.createObjectURL(blob);
        setDisplayUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setDisplayUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!url || !displayUrl) return null;

  return (
    <div
      className={cn(signatureFrameClassName, 'flex items-center justify-center px-3', className)}
    >
      <img
        src={displayUrl}
        alt="Current signature"
        className="mx-auto max-h-24 w-auto max-w-full object-contain"
      />
    </div>
  );
}
