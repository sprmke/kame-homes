import { Copy, ExternalLink } from 'lucide-react';

import { copyPageEditorPublicLink } from '@/features/dashboard/page-editor/lib/pageEditorPublicLinks';

import { Button } from '@/components/ui/button';

type Props = {
  openHref: string;
  copyHref: string;
  pageLabel: string;
};

export function PageEditorPreviewActions({ openHref, copyHref, pageLabel }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Guest page links">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] gap-1.5 px-3"
        onClick={() => void copyPageEditorPublicLink(copyHref, pageLabel)}
      >
        <Copy className="size-3.5" aria-hidden />
        Copy link
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] gap-1.5 px-3"
        asChild
      >
        <a href={openHref} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-3.5" aria-hidden />
          Open page
        </a>
      </Button>
    </div>
  );
}
