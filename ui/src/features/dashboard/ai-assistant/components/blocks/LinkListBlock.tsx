import { Link } from 'react-router-dom';

import { ChevronRight } from 'lucide-react';

import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import {
  useAssistantHref,
  useAssistantSurface,
} from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';

type Props = Extract<ChatBlock, { type: 'link_list' }>;

export function LinkListBlock({ title, links }: Props) {
  const resolveHref = useAssistantHref();
  const { afterNavigate } = useAssistantSurface();
  const visibleLinks = (links ?? []).filter((link) => link.label?.trim() && link.href?.trim());
  if (visibleLinks.length === 0) return null;

  return (
    <div className="border-border/60 bg-card space-y-1 rounded-xl border p-3">
      {title && <p className="text-foreground text-sm font-semibold">{title}</p>}
      <ul className="divide-border/60 -mx-1 divide-y">
        {visibleLinks.map((link) => (
          <li key={link.href}>
            <Link
              to={resolveHref(link.href)}
              onClick={() => afterNavigate?.()}
              className="hover:bg-muted/60 text-foreground flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors"
            >
              <span className="truncate">{link.label}</span>
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
