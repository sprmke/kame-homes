import { cn } from '@/lib/utils';

type Section = {
  label: string;
  children: React.ReactNode;
};

type Props = {
  sections: Section[];
  className?: string;
  /** `grouped` = one bordered card; `stacked` = separate bordered card per section */
  layout?: 'grouped' | 'stacked';
};

function ModalSectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border/60 overflow-hidden rounded-xl border">
      <div className="bg-muted/25 px-4 py-2.5">
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          {label}
        </p>
      </div>
      <div className="px-3 py-3 sm:px-4">{children}</div>
    </div>
  );
}

export function TelegramGroupedModalSections({ sections, className, layout = 'grouped' }: Props) {
  if (layout === 'stacked') {
    return (
      <div className={cn('space-y-4', className)}>
        {sections.map((section) => (
          <ModalSectionCard key={section.label} label={section.label}>
            {section.children}
          </ModalSectionCard>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('border-border/60 overflow-hidden rounded-xl border', className)}>
      {sections.map((section, index) => (
        <div key={section.label} className={cn(index > 0 && 'border-border/60 border-t')}>
          <div className="bg-muted/25 px-4 py-2.5">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              {section.label}
            </p>
          </div>
          <div className="px-3 py-3 sm:px-4">{section.children}</div>
        </div>
      ))}
    </div>
  );
}
