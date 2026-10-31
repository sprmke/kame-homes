import { AlertTriangle, HelpCircle, X } from 'lucide-react';

import {
  TELEGRAM_BOT_TOKEN_HELP,
  TELEGRAM_CHAT_ID_HELP,
  type TelegramHelpSection,
} from '@/features/dashboard/bookings/lib/telegramHelpContent';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from '@/components/ui/responsive-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type TelegramHelpTab = 'bot-token' | 'chat-id';

type Props = {
  defaultTab?: TelegramHelpTab;
  triggerLabel?: string;
  variant?: 'text' | 'icon';
  className?: string;
};

function TelegramHelpSections({ sections }: { sections: TelegramHelpSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section, sectionIndex) => (
        <section key={section.heading ?? sectionIndex} className="space-y-4">
          {section.heading ? (
            <h3 className="text-foreground text-sm font-semibold tracking-tight sm:text-[15px]">
              {section.heading}
            </h3>
          ) : null}
          <ol className="space-y-4">
            {section.steps.map((step, stepIndex) => (
              <li key={step.title} className="flex gap-3.5 sm:gap-4">
                <span
                  className="bg-muted text-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums sm:size-8 sm:text-sm"
                  aria-hidden
                >
                  {stepIndex + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-foreground text-sm font-medium leading-snug sm:text-[15px]">
                    {step.title}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed sm:text-[15px] sm:leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {section.note ? (
            <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              <p className="text-xs leading-relaxed text-amber-950 sm:text-sm dark:text-amber-100">
                {section.note}
              </p>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function TelegramHelpDialog({
  defaultTab = 'bot-token',
  triggerLabel = 'Help',
  variant = 'text',
  className,
}: Props) {
  const helpLabel = defaultTab === 'chat-id' ? 'How to get chat ID' : 'How to get bot token';

  return (
    <ResponsiveModal>
      <ResponsiveModalTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            aria-label={helpLabel}
            className={cn(
              'text-muted-foreground hover:text-foreground focus-visible:ring-ring relative inline-flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors before:absolute before:-inset-2.5 before:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              className
            )}
          >
            <HelpCircle className="size-3.5 shrink-0" aria-hidden />
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'text-muted-foreground hover:text-foreground h-8 gap-1 px-2 text-xs font-medium',
              className
            )}
          >
            <HelpCircle className="size-3.5 shrink-0" aria-hidden />
            {triggerLabel}
          </Button>
        )}
      </ResponsiveModalTrigger>
      <ResponsiveModalContent
        sheetLayout="split"
        showCloseButton={false}
        className={cn(
          'flex max-h-[min(90dvh,52rem)] w-full max-w-[min(calc(100vw-1.5rem),42rem)] flex-col gap-0 overflow-hidden !p-0 sm:!py-3',
          'sm:max-w-[min(92vw,42rem)]'
        )}
      >
        <div className="border-border/60 flex shrink-0 items-center gap-3 border-b px-4 sm:px-0">
          <ResponsiveModalHeader className="min-h-[56px] flex-1 justify-center space-y-0 py-3.5 pr-0">
            <ResponsiveModalTitle className="text-left text-base leading-snug sm:text-lg">
              Telegram setup help
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <ResponsiveModalClose
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            aria-label="Close"
          >
            <X className="size-5 shrink-0" aria-hidden />
          </ResponsiveModalClose>
        </div>

        <Tabs defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
          <div className="border-border/60 shrink-0 border-b px-4 py-3 sm:px-6">
            <TabsList className="bg-muted/45 grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
              <TabsTrigger
                value="bot-token"
                className="min-h-[44px] rounded-lg px-2 text-xs font-semibold sm:min-h-[40px] sm:px-3 sm:text-sm"
              >
                How to get bot token
              </TabsTrigger>
              <TabsTrigger
                value="chat-id"
                className="min-h-[44px] rounded-lg px-2 text-xs font-semibold sm:min-h-[40px] sm:px-3 sm:text-sm"
              >
                How to get chat ID
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
            <TabsContent value="bot-token" className="mt-0 focus-visible:outline-none">
              <TelegramHelpSections sections={TELEGRAM_BOT_TOKEN_HELP} />
            </TabsContent>
            <TabsContent value="chat-id" className="mt-0 focus-visible:outline-none">
              <TelegramHelpSections sections={TELEGRAM_CHAT_ID_HELP} />
            </TabsContent>
          </div>
        </Tabs>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
